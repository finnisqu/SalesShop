import type {QuoteLine,QuoteLineRateReference} from '../types/quote';

/** Encode private product and estimate metadata in the EXISTING rate_reference
 * JSONB column. This is not a customer-facing projection. */
export function quoteCloudLineReference(line:QuoteLine):QuoteLineRateReference|null{
 const hasEstimate=line.costCategory!==undefined||line.productCode!==undefined||
  line.supplierName!==undefined||line.unitLabel!==undefined||
  line.unitCost!==undefined||line.internalOnlyCost!==undefined;
 if(!hasEstimate&&!line.otherReference)return line.rateReference??null;
 return {
  ...(line.rateReference??{}),
  ...(line.otherReference?{otherCatalog:line.otherReference}:{}),
  ...(hasEstimate?{estimate:{
   ...(line.rateReference?.estimate??{}),
   costCategory:line.costCategory,productCode:line.productCode,
   supplierName:line.supplierName,unitLabel:line.unitLabel,
   unitCost:line.unitCost,internalOnlyCost:line.internalOnlyCost,
  }}:{}),
 };
}

/** Decode only known metadata. Old cloud records without the OTHER snapshot
 * still work, and the snapshot's private unit cost remains available even if
 * historical rows have no separate estimate.unitCost. */
export function quoteCloudLineMetadata(value:unknown):Partial<QuoteLine>{
 const reference=value&&typeof value==='object'&&!Array.isArray(value)
  ?value as QuoteLineRateReference:undefined;
 const estimate=reference?.estimate;
 return {
  rateReference:reference,
  otherReference:reference?.otherCatalog,
  costCategory:estimate?.costCategory,
  productCode:estimate?.productCode,
  supplierName:estimate?.supplierName,
  unitLabel:estimate?.unitLabel,
  unitCost:estimate?.unitCost??reference?.otherCatalog?.snapshot?.internalCost,
  internalOnlyCost:estimate?.internalOnlyCost,
 };
}
