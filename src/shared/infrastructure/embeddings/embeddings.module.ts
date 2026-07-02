import { Global, Module } from '@nestjs/common';
import { EMBEDDING_PORT } from './embedding.port';
import { HttpEmbeddingAdapter } from './http-embedding.adapter';
import { VectorStore } from './vector-store.service';

@Global()
@Module({
  providers: [{ provide: EMBEDDING_PORT, useClass: HttpEmbeddingAdapter }, VectorStore],
  exports: [EMBEDDING_PORT, VectorStore],
})
export class EmbeddingsModule {}
