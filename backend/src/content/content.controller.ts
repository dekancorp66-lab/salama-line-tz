import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateContentDto } from './dto/create-content.dto';
import { ReviewContentDto } from './dto/review-content.dto';
import { ContentService } from './content.service';

@ApiTags('approved-content')
@Controller('content')
export class ContentController {
  constructor(private service: ContentService) {}
  @Get() list(@Query('language') language = 'sw', @Query('topic') topic?: string) { return this.service.list(language, topic); }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CONTENT_REVIEWER')
  @Post()
  create(@Body() dto: CreateContentDto) { return this.service.create(dto); }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CONTENT_REVIEWER')
  @Post(':id/review')
  review(@Param('id') id: string, @Body() body: ReviewContentDto, @CurrentUser() user: any) {
    return this.service.review(id, user, body.approve === true, body.notes);
  }
}
