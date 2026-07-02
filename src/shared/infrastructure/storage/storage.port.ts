/** Outbound port for object storage. Implemented by the MinIO/S3 adapter; faked in tests. */
export interface StoragePort {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  presignGetUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
export const STORAGE_PORT = Symbol('STORAGE_PORT');
