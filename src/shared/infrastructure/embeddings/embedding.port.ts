/** Outbound port for text embeddings. Implemented by an OpenAI-compatible adapter; faked in tests. */
export interface EmbeddingPort {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
}
export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');
