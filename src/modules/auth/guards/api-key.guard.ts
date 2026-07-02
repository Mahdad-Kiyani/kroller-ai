import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '@shared/infrastructure/config/configuration';
import { PUBLIC_KEY } from '../decorators/public.decorator';

/** Service-to-service auth: panel/portal send the shared key as `x-api-key`. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-api-key'];
    if (!provided || provided !== this.config.get('serviceApiKey', { infer: true })) {
      throw new UnauthorizedException('Invalid or missing x-api-key.');
    }
    return true;
  }
}
