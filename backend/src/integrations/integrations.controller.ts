import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('channel-integrations')
@Controller('integrations')
export class IntegrationsController {
  @Get('status')
  status() {
    return {
      ussd: 'adapter-not-configured',
      sms: process.env.SMS_PROVIDER === 'disabled' ? 'disabled' : 'configured-needs-verification',
      whatsapp: process.env.WHATSAPP_PROVIDER === 'disabled' ? 'disabled' : 'configured-needs-verification',
      note: 'Provider webhooks require provider-specific signature verification before production use.',
    };
  }

  @Post('ussd/callback')
  ussd(@Body() body: Record<string, unknown>) {
    // Deliberately no real provider protocol assumed. Configure a verified provider adapter first.
    return { status: 'not_configured', message: 'USSD provider adapter is not configured.', receivedFields: Object.keys(body).slice(0, 10) };
  }

  @Post('sms/webhook')
  sms() {
    return { status: 'not_configured', message: 'SMS provider webhook must be implemented with signature verification and replay protection.' };
  }

  @Post('whatsapp/webhook')
  whatsapp() {
    return { status: 'not_configured', message: 'WhatsApp provider webhook must be implemented with provider signature verification.' };
  }
}
