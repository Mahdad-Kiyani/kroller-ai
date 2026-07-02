import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '@modules/auth/decorators/public.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + DB connectivity probe' })
  @ApiOkResponse({ schema: { example: { status: 'ok', db: 'up' } } })
  async health(): Promise<{ status: string; db: string }> {
    let db = 'down';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    return { status: 'ok', db };
  }
}
