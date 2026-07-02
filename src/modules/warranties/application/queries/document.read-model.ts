import { DocumentStatus } from '@prisma/client';
export interface DocumentReadModel {
  id: string;
  dealId: string;
  filename: string;
  mimeType: string;
  status: DocumentStatus;
  error: string | null;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}
