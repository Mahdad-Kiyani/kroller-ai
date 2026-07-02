import { Injectable, Logger } from '@nestjs/common';

/** Extracts plain text from an uploaded document buffer (txt / docx / pdf). */
@Injectable()
export class DocumentTextExtractor {
  private readonly logger = new Logger(DocumentTextExtractor.name);

  async extract(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessing')) {
      this.logger.debug(`Extracting Word document (${buffer.length}B)`);
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer });
      this.logger.debug(`Word extraction done: ${value.length} chars`);
      return value;
    }
    if (mimeType.includes('pdf')) {
      this.logger.debug(`Extracting PDF (${buffer.length}B)`);
      const pdfParse = (await import('pdf-parse')).default;
      const { text } = await pdfParse(buffer);
      this.logger.debug(`PDF extraction done: ${text.length} chars`);
      return text;
    }
    this.logger.debug(`Treating as plain text (mimeType=${mimeType}) ${buffer.length}B`);
    return buffer.toString('utf-8');
  }
}
