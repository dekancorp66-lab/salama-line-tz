import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
@ApiTags('verified-service-directory')
@Controller('services')
export class ServicesController {
  constructor(private service: ServicesService) {}
  @Get() list(@Query('district') district?: string, @Query('type') type?: string) {
    return this.service.list(district, type);
  }
}
