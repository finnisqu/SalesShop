import type { SupplierImportParser, SupplierImportParserContext, SupplierImportProfile, SupplierImportSession } from '../types/supplierImport';
import { vicostoneSupplierParser } from './vicostoneSupplierImport';

export const supplierImportParsers: readonly SupplierImportParser[] = [
  vicostoneSupplierParser,
];

export const supplierImportProfiles: readonly SupplierImportProfile[] = [
  {
    id: 'vicostone-via-umi',
    label: 'Vicostone · via UMI',
    supplier: 'UMI',
    brand: 'Vicostone',
    materialType: 'Quartz',
    parserId: vicostoneSupplierParser.id,
    fileTypeLabel: 'Fabricator PDF',
    accept: 'application/pdf,.pdf',
    description: 'Vicostone fabricator pricing distributed by UMI. Reads only explicitly listed colors, physical specs and supplier prices.',
  },
];

export function getSupplierImportProfile(profileId: string): SupplierImportProfile {
  const profile = supplierImportProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Unknown supplier import profile: ${profileId}`);
  return profile;
}

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
