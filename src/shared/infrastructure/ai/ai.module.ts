import { Global, Module } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

@Global()
@Module({ providers: [ClaudeClient], exports: [ClaudeClient] })
export class AiModule {}
