import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HelpRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { UpdateHelpRequestStatusDto } from './dto/update-help-request-status.dto';
import { HelpRequestsService } from './help-requests.service';

@ApiTags('help-requests')
@Controller('help-requests')
export class HelpRequestsController {
  constructor(private service: HelpRequestsService) {}
  @Post() create(@Body() dto: CreateHelpRequestDto) { return this.service.create(dto); }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RESPONDER')
  @Get()
  list(@Query('district') district?: string, @CurrentUser() user?: any) {
    const safeDistrict = user?.role === 'ADMIN' ? district : user?.districtCode;
    return this.service.listForStaff(safeDistrict);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RESPONDER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateHelpRequestStatusDto, @CurrentUser() user: any) {
    return this.service.updateStatus(id, body.status as HelpRequestStatus, user.id);
  }
}
