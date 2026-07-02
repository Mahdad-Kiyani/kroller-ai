import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const { method, url, ip } = req;
    const start = Date.now();

    this.logger.log(`→ ${method} ${url} [${ip}]`);

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.switchToHttp().getResponse<Response>();
          this.logger.log(`← ${method} ${url} ${res.statusCode} (${Date.now() - start}ms)`);
        },
        error: (err: Error) => {
          this.logger.error(`← ${method} ${url} ERROR (${Date.now() - start}ms): ${err.message}`);
        },
      }),
    );
  }
}
