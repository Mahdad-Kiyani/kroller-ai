/** Outbound port for AI parsing. Claude adapter implements it; tests inject a fake. */
export interface ParsedWarrantyRow {
  spaReference: string;
  title: string;
  fullText: string;
  category: string; // raw label, validated into the 4-bucket VO by the handler
  confidence: number; // 0..1
  pageRef?: number;
}
export interface WarrantyParserPort {
  parse(input: { storageKey: string; mimeType: string }): Promise<ParsedWarrantyRow[]>;
}
export const WARRANTY_PARSER = Symbol('WARRANTY_PARSER');
