import type { SupplierImportParser, SupplierImportParserContext, SupplierImportProfile, SupplierImportSession } from '../types/supplierImport';
import { vicostoneSupplierParser } from './vicostoneSupplierImport';
import {
  SALESSHOP_TEMPLATE_PARSER_ID,
  salesShopMaterialTemplateParser,
} from './salesShopMaterialTemplateImport';

export const supplierImportParsers: readonly SupplierImportParser[] = [
  salesShopMaterialTemplateParser,
  vicostoneSupplierParser,
];

export const supplierImportProfiles: readonly SupplierImportProfile[] = [
  {
    id: 'salesshop-material-template',
    label: 'SalesShop Material Template',
    parserId: SALESSHOP_TEMPLATE_PARSER_ID,
    fileTypeLabel: 'Material Import Template (.xlsx)',
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx',
    description: 'Canonical SalesShop material-import workbook. Supplier interpretation happens before upload; SalesShop validates explicit normalized rows only.',
    supportsEffectiveDateOverride: false,
  },
  {
    id: 'vicostone-via-umi',
    label: 'Vicostone · via UMI',
    supplier: 'UMI',
    brand: 'Vicostone',
    materialType: 'Quartz',
    parserId: vicostoneSupplierParser.id,
    fileTypeLabel: 'Fabricator PDF',
    accept: 'application/pdf,.pdf',
    description: 'Legacy direct import for the proven Vicostone / UMI fabricator PDF.',
    supportsEffectiveDateOverride: true,
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
