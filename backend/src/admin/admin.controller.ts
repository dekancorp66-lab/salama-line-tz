import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContentStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import {
  ADMIN_ROLES,
  AI_KNOWLEDGE_MANAGEMENT_ROLES,
  AUDIT_READ_ROLES,
  CASE_MANAGEMENT_ROLES,
  CONTENT_MANAGEMENT_ROLES,
  SERVICE_MANAGEMENT_ROLES,
} from '../common/roles';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { isSuperAdmin } from '../common/super-admin';
import { PrismaService } from '../database/prisma.service';
import { ApproveAiKnowledgeDto } from './dto/approve-ai-knowledge.dto';
import { CreateAiKnowledgeSourceDto } from './dto/create-ai-knowledge-source.dto';
import { CreateConsentPolicyDto } from './dto/create-consent-policy.dto';
import { CreateServiceEntryDto } from './dto/create-service-entry.dto';
import { ResponderAvailabilityDto } from './dto/responder-availability.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { VerifyServiceDto } from './dto/verify-service.dto';

interface AuthenticatedAdmin {
  id: string;
  email: string;
  role?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private take(value: number): number {
    return Math.min(Math.max(value, 1), 100);
  }

  private skip(value: number): number {
    return Math.max(value, 0);
  }

  // --- Staff and responder management -------------------------------------

  @Get('users')
  users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        districtCode: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('responders')
  responders() {
    return this.prisma.user.findMany({
      where: { role: UserRole.RESPONDER },
      select: {
        id: true,
        email: true,
        displayName: true,
        districtCode: true,
        isActive: true,
        responderProfile: {
          select: { available: true, districtCode: true, maxActiveCases: true, updatedAt: true },
        },
      },
      orderBy: { displayName: 'asc' },
    });
  }

  @Patch('users/:id/access')
  @ApiOperation({
    summary: 'Activate, deactivate, or change the access of a user',
    description:
      'Requires an active administrator. Only a super administrator can grant or modify administrative access.',
  })
  async access(
    @Param('id') id: string,
    @Body() body: UpdateUserAccessDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const actorIsSuperAdmin = isSuperAdmin(actor);
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, isActive: true },
    });
    if (!target) throw new NotFoundException('User not found');

    if (!actorIsSuperAdmin && (target.role === UserRole.ADMIN || isSuperAdmin(target))) {
      throw new ForbiddenException('Only the super administrator can change administrator access');
    }
    if (
      (body.role === UserRole.ADMIN || body.role === UserRole.SUPER_ADMIN) &&
      !actorIsSuperAdmin
    ) {
      throw new ForbiddenException('Only the super administrator can grant administrator access');
    }
    if (
      isSuperAdmin(target) &&
      (body.isActive === false || (body.role && body.role !== target.role))
    ) {
      throw new ForbiddenException('The super administrator account cannot be deactivated or downgraded');
    }

    const statusChanged = target.isActive !== body.isActive;
    const roleChanged = Boolean(body.role && body.role !== target.role);
    const result = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: body.isActive,
        ...(body.role ? { role: body.role } : {}),
        ...(body.districtCode !== undefined ? { districtCode: body.districtCode || null } : {}),
        ...(statusChanged || roleChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, email: true, displayName: true, role: true, districtCode: true, isActive: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_USER_ACCESS_UPDATED',
      resourceType: 'USER',
      resourceId: id,
      outcome: 'success',
    });
    return result;
  }

  @Patch('users/:id/availability')
  async availability(
    @Param('id') id: string,
    @Body() body: ResponderAvailabilityDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role !== UserRole.RESPONDER) {
      throw new ForbiddenException('Availability can only be managed for responder accounts');
    }

    const districtCode = body.districtCode?.trim().toUpperCase() || null;
    if (districtCode) {
      await this.prisma.user.update({
        where: { id },
        data: { districtCode },
        select: { id: true },
      });
    }
    const profile = await this.prisma.responderProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        available: body.available,
        districtCode,
        maxActiveCases: body.maxActiveCases ?? 10,
      },
      update: {
        available: body.available,
        ...(districtCode !== null ? { districtCode } : {}),
        ...(body.maxActiveCases !== undefined ? { maxActiveCases: body.maxActiveCases } : {}),
      },
      select: { userId: true, districtCode: true, available: true, maxActiveCases: true, updatedAt: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_RESPONDER_AVAILABILITY_UPDATED',
      resourceType: 'USER',
      resourceId: id,
      outcome: body.available ? 'available' : 'unavailable',
    });
    return profile;
  }

  // --- Verified service directory -----------------------------------------

  /**
   * Read-only list for case workers making a referral. Only active entries
   * whose verification has not expired are exposed; draft data stays private.
   */
  @Get('verified-services')
  @Roles(...CASE_MANAGEMENT_ROLES)
  verifiedServicesForCaseWorkers() {
    return this.prisma.serviceDirectoryEntry.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        name: true,
        type: true,
        districtCode: true,
        region: true,
        phonePublic: true,
      },
      orderBy: [{ districtCode: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }

  @Get('services')
  @Roles(...SERVICE_MANAGEMENT_ROLES)
  reviewableServices(
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.prisma.serviceDirectoryEntry.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        districtCode: true,
        region: true,
        phonePublic: true,
        verificationOrg: true,
        verifiedBy: true,
        verifiedAt: true,
        expiresAt: true,
        isActive: true,
      },
      orderBy: [{ isActive: 'asc' }, { name: 'asc' }],
      take: this.take(take),
      skip: this.skip(skip),
    });
  }

  @Post('services')
  @Roles(...SERVICE_MANAGEMENT_ROLES)
  async createService(@Body() dto: CreateServiceEntryDto, @CurrentUser() actor: AuthenticatedAdmin) {
    const entry = await this.prisma.serviceDirectoryEntry.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        districtCode: dto.districtCode.trim().toUpperCase(),
        region: dto.region.trim(),
        phonePublic: dto.phonePublic?.trim() || null,
        address: dto.address?.trim() || null,
        openingHours: dto.openingHours?.trim() || null,
        languages: dto.languages ?? [],
        verificationOrg: dto.verificationOrg.trim(),
        verifiedBy: dto.verifiedBy.trim(),
        verifiedAt: new Date(dto.verifiedAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: false,
      },
      select: { id: true, name: true, districtCode: true, isActive: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_SERVICE_ENTRY_CREATED',
      resourceType: 'SERVICE',
      resourceId: entry.id,
      outcome: 'draft',
    });
    return entry;
  }

  @Patch('services/:id/verify')
  @Roles(...SERVICE_MANAGEMENT_ROLES)
  async verifyService(
    @Param('id') id: string,
    @Body() body: VerifyServiceDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const current = await this.prisma.serviceDirectoryEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Service entry not found');
    const result = await this.prisma.serviceDirectoryEntry.update({
      where: { id },
      data: {
        isActive: body.isActive,
        ...(body.verifiedAt ? { verifiedAt: new Date(body.verifiedAt) } : {}),
        ...(body.expiresAt !== undefined
          ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
          : {}),
        ...(body.verificationOrg ? { verificationOrg: body.verificationOrg.trim() } : {}),
        ...(body.verifiedBy ? { verifiedBy: body.verifiedBy.trim() } : {}),
      },
      select: { id: true, name: true, verifiedAt: true, expiresAt: true, isActive: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_SERVICE_ENTRY_VERIFIED',
      resourceType: 'SERVICE',
      resourceId: id,
      outcome: body.isActive ? 'active' : 'inactive',
    });
    return result;
  }

  // --- Content moderation --------------------------------------------------

  @Get('content')
  @Roles(...CONTENT_MANAGEMENT_ROLES)
  contentQueue(
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.prisma.content.findMany({
      where: { status: { not: ContentStatus.APPROVED } },
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        topic: true,
        status: true,
        sourceName: true,
        reviewerId: true,
        reviewedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: this.take(take),
      skip: this.skip(skip),
    });
  }

  @Patch('content/:id/archive')
  @Roles(...CONTENT_MANAGEMENT_ROLES)
  async archiveContent(@Param('id') id: string, @CurrentUser() actor: AuthenticatedAdmin) {
    const current = await this.prisma.content.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException('Content not found');
    const result = await this.prisma.content.update({
      where: { id },
      data: {
        status: ContentStatus.ARCHIVED,
        reviewerId: actor.id,
        reviewedAt: new Date(),
        publishedAt: null,
      },
      select: { id: true, slug: true, status: true, reviewedAt: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_CONTENT_ARCHIVED',
      resourceType: 'CONTENT',
      resourceId: id,
      outcome: 'success',
    });
    return result;
  }

  // --- Consent policies ----------------------------------------------------

  @Get('consent-policies')
  consentPolicies() {
    return this.prisma.consentPolicy.findMany({
      select: {
        id: true,
        version: true,
        wording: true,
        effectiveAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('consent-policies')
  async createConsentPolicy(
    @Body() dto: CreateConsentPolicyDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const policy = await this.prisma.consentPolicy.create({
      data: { version: dto.version.trim(), wording: dto.wording.trim() },
      select: { id: true, version: true, wording: true, effectiveAt: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_CONSENT_POLICY_CREATED',
      resourceType: 'CONSENT_POLICY',
      resourceId: policy.id,
      outcome: 'success',
    });
    return policy;
  }

  @Patch('consent-policies/:id/revoke')
  async revokeConsentPolicy(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const current = await this.prisma.consentPolicy.findUnique({
      where: { id },
      select: { id: true, revokedAt: true },
    });
    if (!current) throw new NotFoundException('Consent policy not found');
    const result = await this.prisma.consentPolicy.update({
      where: { id },
      data: { revokedAt: current.revokedAt ?? new Date() },
      select: { id: true, version: true, revokedAt: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_CONSENT_POLICY_REVOKED',
      resourceType: 'CONSENT_POLICY',
      resourceId: id,
      outcome: 'success',
    });
    return result;
  }

  // --- Approved AI knowledge ----------------------------------------------

  @Get('ai-knowledge')
  @Roles(...AI_KNOWLEDGE_MANAGEMENT_ROLES)
  aiKnowledgeSources() {
    return this.prisma.aiKnowledgeSource.findMany({
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        jurisdiction: true,
        version: true,
        contentHash: true,
        approved: true,
        approvedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('ai-knowledge')
  @Roles(...AI_KNOWLEDGE_MANAGEMENT_ROLES)
  async createAiKnowledgeSource(
    @Body() dto: CreateAiKnowledgeSourceDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const source = await this.prisma.aiKnowledgeSource.create({
      data: {
        title: dto.title.trim(),
        sourceType: dto.sourceType.trim(),
        sourceUrl: dto.sourceUrl?.trim() || null,
        jurisdiction: dto.jurisdiction?.trim().toUpperCase() || 'MAINLAND_TANZANIA',
        version: dto.version.trim(),
        contentHash: dto.contentHash.toLowerCase(),
        approved: false,
      },
      select: { id: true, title: true, version: true, approved: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_AI_KNOWLEDGE_CREATED',
      resourceType: 'AI_KNOWLEDGE_SOURCE',
      resourceId: source.id,
      outcome: 'draft',
    });
    return source;
  }

  @Patch('ai-knowledge/:id/approve')
  @Roles(...AI_KNOWLEDGE_MANAGEMENT_ROLES)
  async approveAiKnowledgeSource(
    @Param('id') id: string,
    @Body() body: ApproveAiKnowledgeDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const current = await this.prisma.aiKnowledgeSource.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('AI knowledge source not found');
    const result = await this.prisma.aiKnowledgeSource.update({
      where: { id },
      data: {
        approved: body.approved,
        approvedById: body.approved ? actor.id : null,
        approvedAt: body.approved ? new Date() : null,
      },
      select: { id: true, title: true, approved: true, approvedAt: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_AI_KNOWLEDGE_APPROVAL_CHANGED',
      resourceType: 'AI_KNOWLEDGE_SOURCE',
      resourceId: id,
      outcome: body.approved ? 'approved' : 'withdrawn',
    });
    return result;
  }

  // --- Audit and operations ------------------------------------------------

  @Get('audit')
  @Roles(...AUDIT_READ_ROLES)
  auditEvents(
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('outcome') outcome?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take?: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
  ) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(resourceType ? { resourceType } : {}),
        ...(outcome ? { outcome } : {}),
        ...(actorUserId ? { actorUserId } : {}),
      },
      select: {
        id: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        outcome: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: this.take(take ?? 50),
      skip: this.skip(skip ?? 0),
    });
  }

  @Get('metrics')
  async metrics(@CurrentUser() actor: AuthenticatedAdmin) {
    const [cases, approvedContent, verifiedServices] = await Promise.all([
      this.prisma.helpRequest.count(),
      this.prisma.content.count({ where: { status: 'APPROVED' } }),
      this.prisma.serviceDirectoryEntry.count({ where: { isActive: true } }),
    ]);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ADMIN_METRICS_VIEWED',
      resourceType: 'SYSTEM',
      outcome: 'success',
    });
    return {
      cases: cases >= 5 ? cases : null,
      approvedContent,
      verifiedServices,
      smallCountsSuppressed: cases < 5,
    };
  }
}
