import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Unable to create account with these details');
    const rounds = Math.max(12, Number(process.env.BCRYPT_ROUNDS || 12));
    const passwordHash = await bcrypt.hash(dto.password, Math.min(rounds, 14));
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: dto.displayName.trim(), isActive: false },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    return { message: 'Account created. An administrator must activate staff access.', user };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    const valid = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !valid || !user.isActive) throw new UnauthorizedException('Invalid credentials or account not activated');
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, tokenType: 'Bearer', expiresIn: process.env.JWT_ACCESS_TTL || '15m',
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, districtCode: user.districtCode } };
  }
}
