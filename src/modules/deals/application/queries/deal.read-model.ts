export interface DealReadModel {
  id: string;
  externalRef: string;
  name: string;
  governingLaw: string | null;
  createdAt: Date;
}
