export class UploadDocumentCommand {
  constructor(
    readonly dealId: string,
    readonly filename: string,
    readonly mimeType: string,
    readonly buffer: Buffer,
  ) {}
}
