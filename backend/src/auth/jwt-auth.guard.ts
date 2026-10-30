import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly strategy: JwtStrategy) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    req.user = await this.strategy.authenticate(req.headers.authorization);
    return true;
  }
}
