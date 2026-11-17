import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HelpRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ADMIN_ROLES, CASE_MANAGEMENT_ROLES, isAdminRole } from '../common/roles';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AssignCaseDto } from './dto/assign-case.dto';
import { CreateCaseNoteDto } from './dto/create-case-note.dto';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { EscalateCaseDto } from './dto/escalate-case.dto';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { RevokeConsentDto } from './dto/revoke-consent.dto';
import { UpdateHelpRequestStatusDto } from './dto/update-help-request-status.dto';
import { HelpRequestsService } from './help-requests.service';

@ApiTags('help-requests')
@Controller('help-requests')
export class HelpRequestsController {
  constructor(private service: HelpRequestsService) {}

  /** Public intake. Never returns contact details or alerts third parties. */
  @Post()
  create(@Body() dto: CreateHelpRequestDto) {
    return this.service.create(dto);
  }

  /** Literal route declared before :id routes to avoid parameter capture. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post('retention/sweep')
  sweepExpired() {
    return this.service.sweepExpired();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Get()
  list(@Query('district') district?: string, @CurrentUser() user?: any) {
    const allowAllDistricts = isAdminRole(user?.role) && !district?.trim();
    return this.service.listForStaff(
      isAdminRole(user?.role) ? district : user?.districtCode,
      allowAllDistricts,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getCase(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateHelpRequestStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateStatus(id, body.status as HelpRequestStatus, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: AssignCaseDto, @CurrentUser() user: any) {
    return this.service.assign(id, body, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Get(':id/notes')
  listNotes(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.listNotes(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() body: CreateCaseNoteDto, @CurrentUser() user: any) {
    return this.service.addNote(id, body, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Post(':id/escalate')
  escalate(@Param('id') id: string, @Body() body: EscalateCaseDto, @CurrentUser() user: any) {
    return this.service.escalate(id, body, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Post(':id/consent/grant')
  grantConsent(@Param('id') id: string, @Body() body: GrantConsentDto, @CurrentUser() user: any) {
    return this.service.grantConsent(id, body, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Post(':id/consent/revoke')
  revokeConsent(@Param('id') id: string, @Body() body: RevokeConsentDto, @CurrentUser() user: any) {
    return this.service.revokeConsent(id, body, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Get(':id/referrals')
  listReferrals(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.listReferrals(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASE_MANAGEMENT_ROLES)
  @Post(':id/referrals')
  createReferral(
    @Param('id') id: string,
    @Body() body: CreateReferralDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createReferral(id, body, user);
  }
}
