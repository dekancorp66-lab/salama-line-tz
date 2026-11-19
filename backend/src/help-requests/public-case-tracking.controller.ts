import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicCaseTrackingService } from './public-case-tracking.service';
import { TrackCaseDto } from './dto/track-case.dto';

/**
 * Deliberately separate from HelpRequestsController: a public controller with
 * no JWT/Roles guards and an explicitly minimal response contract. Existing
 * authenticated case endpoints and their authorization are left untouched.
 */
@ApiTags('case-tracking')
@Controller('case-tracking')
export class PublicCaseTrackingController {
  constructor(private readonly service: PublicCaseTrackingService) {}

  @ApiOperation({
    summary: 'Track a help request by its public case reference',
    description:
      'Returns only public progress information. Does not require an account or expose case details.',
  })
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Get(':caseCode')
  track(@Param() params: TrackCaseDto) {
    return this.service.track(params.caseCode);
  }
}
