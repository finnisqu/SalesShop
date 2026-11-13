import type { QuoteLineMaterialReference } from '../types/quote';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';

export interface SelectedMaterialCostReference {
  materialName: string;
  /** The supplier cost captured when this material was chosen for this Area. */
  quotedCostPerSf?: number;
  /** Current Catalog cost for the exact material/variant/purchase option, if still present. */
  currentCatalogCostPerSf?: number;
  catalogCostChanged: boolean;
  /** Captured variant/program is missing or inactive; quoted buying cost remains intact. */
  catalogSourceUnavailable:boolean;
  materialType?: string;
}

function validCost(value:unknown):number|undefined {
  return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:undefined;
}

/**
 * Internal-only buying cost reference for the mobile quote RATE picker.
 * Never reads a sell rate as buying cost. Never silently reprices an existing
 * quote when supplier Catalog pricing changes.
 */
export function selectedMaterialCost(
  materialName:string,
  reference:QuoteLineMaterialReference|undefined,
  materials:readonly StockMaterial[],
):SelectedMaterialCostReference {
  const quotedCostPerSf=validCost(reference?.sourceCostPerSf)
    ??validCost(reference?.snapshot?.costPerSf);
  // Use the frozen snapshot's exact variant/program for older quote records
  // that do not carry those IDs in the outer reference object.
  const materialId=reference?.materialId??reference?.snapshot?.materialId;
  const variantId=reference?.variantId??reference?.snapshot?.variantId;
  const purchaseOptionId=reference?.purchaseOptionId??reference?.snapshot?.purchaseOptionId;
  const material=materialId?materials.find(item=>item.id===materialId&&item.active):undefined;
  const variant=variantId?material?.variants?.find(item=>
    item.id===variantId&&item.active!==false):undefined;
  // Never compare a saved quote against an unrelated default variant/program.
  const variantMissing=Boolean(material?.variants?.length&&!variant);
  const optionMissing=Boolean(purchaseOptionId&&
    !variant?.purchaseOptions?.some(option=>option.id===purchaseOptionId&&option.active!==false));
  const currentCatalogCostPerSf=material&&!variantMissing&&!optionMissing
    ?validCost(resolveStockMaterialCostReference(
      material,variantId,purchaseOptionId).costPerSf):undefined;
  return {
    materialName:materialName.trim()||reference?.snapshot?.materialName||'Material not selected',
    quotedCostPerSf,
    currentCatalogCostPerSf,
    catalogCostChanged:quotedCostPerSf!==undefined&&currentCatalogCostPerSf!==undefined
      &&Math.abs(currentCatalogCostPerSf-quotedCostPerSf)>=0.005,
    catalogSourceUnavailable:Boolean(materialId&&(!material||variantMissing||optionMissing)),
    materialType:reference?.snapshot?.materialType??material?.materialType,
  };
}
