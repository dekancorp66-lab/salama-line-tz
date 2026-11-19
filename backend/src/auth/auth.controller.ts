import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: any }) {
    return { user: req.user };
  }
}
