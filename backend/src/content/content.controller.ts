import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CONTENT_MANAGEMENT_ROLES } from '../common/roles';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateContentDto } from './dto/create-content.dto';
import { ReviewContentDto } from './dto/review-content.dto';
import { ContentService } from './content.service';

@ApiTags('approved-content')
@Controller('content')
export class ContentController {
  constructor(private service: ContentService) {}

  @Get()
  list(@Query('language') language = 'sw', @Query('topic') topic?: string) {
    return this.service.list(language, topic);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CONTENT_MANAGEMENT_ROLES)
  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CONTENT_MANAGEMENT_ROLES)
  @Post(':id/review')
  review(@Param('id') id: string, @Body() body: ReviewContentDto, @CurrentUser() user: any) {
    return this.service.review(id, user, body.approve === true, body.notes);
  }
}
