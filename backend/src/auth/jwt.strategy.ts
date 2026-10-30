import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JwtStrategy {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async authenticate(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(authorization.slice(7));
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();
      return { id: user.id, email: user.email, role: user.role, districtCode: user.districtCode };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
