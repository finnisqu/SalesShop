import type { SupplierImportParser, SupplierImportParserContext, SupplierImportSession } from '../types/supplierImport';
import { vicostoneSupplierParser } from './vicostoneSupplierImport';

export const supplierImportParsers: readonly SupplierImportParser[] = [
  vicostoneSupplierParser,
];

export function getSupplierImportParser(parserId: string): SupplierImportParser {
  const parser = supplierImportParsers.find((candidate) => candidate.id === parserId);
  if (!parser) throw new Error(`Unknown supplier import parser: ${parserId}`);
  return parser;
}

export async function stageSupplierImport(
  parserId: string,
  file: File,
  context: SupplierImportParserContext,
): Promise<SupplierImportSession> {
  const parser = getSupplierImportParser(parserId);
  if (!parser.accepts(file)) {
    throw new Error(`${parser.label} does not accept this file type.`);
  }
  return parser.stage(file, context);
}
