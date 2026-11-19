import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('channel-integrations')
@Controller('integrations')
export class IntegrationsController {
  @Get('status')
  status() {
    // These Nest adapters are placeholders by design. Credentials alone do not
    // make a channel operational: signature verification, replay protection and
    // delivery handling must be implemented and verified first. Report only facts.
    const has = (key: string) => Boolean(process.env[key]?.trim());
    const disabled = (key: string) => process.env[key]?.trim() === 'disabled';
    const state = (providerKey: string, credentials: boolean) => ({
      status: disabled(providerKey)
        ? 'disabled'
        : credentials
          ? 'credentials-present-adapter-pending'
          : 'adapter-not-configured',
      configured: false,
      operational: false,
    });
    return {
      ussd: { status: 'adapter-not-configured', configured: false, operational: false },
      sms: state('SMS_PROVIDER', has('SMS_PROVIDER') && has('SMS_API_KEY')),
      whatsapp: state('WHATSAPP_PROVIDER', has('WHATSAPP_PROVIDER') && has('WHATSAPP_TOKEN')),
      note: 'No channel is represented as operational until its provider adapter, signature verification and replay protection are implemented and verified.',
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
