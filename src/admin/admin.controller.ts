import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { isSuperAdminEmail } from '../common/super-admin';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';

interface AuthenticatedAdmin {
  email: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}
  @Get('users') users() {
    return this.prisma.user.findMany({ select: { id: true, email: true, displayName: true, role: true, districtCode: true, isActive: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }
  @Patch('users/:id/access')
  @ApiOperation({
    summary: 'Activate, deactivate, or change the access of a user',
    description: 'Requires an active administrator. Only wilbardmagaso777@gmail.com can grant ADMIN access or change an existing administrator account.',
  })
  async access(
    @Param('id') id: string,
    @Body() body: UpdateUserAccessDto,
    @CurrentUser() actor: AuthenticatedAdmin,
  ) {
    const isSuperAdmin = isSuperAdminEmail(actor.email);
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!isSuperAdmin && (target.role === 'ADMIN' || isSuperAdminEmail(target.email))) {
      throw new ForbiddenException('Only the super administrator can change administrator access');
    }
    if (body.role === 'ADMIN' && !isSuperAdmin) {
      throw new ForbiddenException('Only the super administrator can grant administrator access');
    }
    if (isSuperAdminEmail(target.email) && (body.isActive === false || (body.role && body.role !== 'ADMIN'))) {
      throw new ForbiddenException('The super administrator account cannot be deactivated or downgraded');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: body.isActive, ...(body.role ? { role: body.role } : {}), ...(body.districtCode !== undefined ? { districtCode: body.districtCode || null } : {}) },
      select: { id: true, email: true, displayName: true, role: true, districtCode: true, isActive: true },
    });
  }
  @Get('metrics')
  async metrics() {
    const [cases, approvedContent, verifiedServices] = await Promise.all([
      this.prisma.helpRequest.count(),
      this.prisma.content.count({ where: { status: 'APPROVED' } }),
      this.prisma.serviceDirectoryEntry.count({ where: { isActive: true } }),
    ]);
    return { cases: cases >= 5 ? cases : null, approvedContent, verifiedServices, smallCountsSuppressed: cases < 5 };
  }
}
