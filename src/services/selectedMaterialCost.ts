import type { QuoteLineMaterialReference } from '../types/quote';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';

export interface SelectedMaterialCostReference {
  materialName: string;
  /** The supplier cost captured when this material was chosen for this Area. */
  quotedCostPerSf?: number;
  /** Current Catalog cost for the exact material/variant/purchase option, if still present. */
  currentCatalogCostPerSf?: number;
  catalogCostChanged: boolean;
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
  const material=reference?.materialId
    ?materials.find(item=>item.id===reference.materialId&&item.active):undefined;
  const variant=reference?.variantId
    ?material?.variants?.find(item=>item.id===reference.variantId&&item.active!==false):undefined;
  // A deleted/replaced variant or purchase option must not silently resolve
  // to the Catalog default and present the wrong supplier price.
  const variantMissing=!!reference?.variantId&&!variant;
  const optionMissing=!!reference?.purchaseOptionId
    &&(!variant||!variant.purchaseOptions.some(option=>
      option.id===reference.purchaseOptionId&&option.active!==false));
  const currentCatalogCostPerSf=material&&!variantMissing&&!optionMissing
    ?validCost(resolveStockMaterialCostReference(
      material,reference?.variantId,reference?.purchaseOptionId).costPerSf)
    :undefined;
  return {
    materialName:materialName.trim()||reference?.snapshot?.materialName||'Material not selected',
    quotedCostPerSf,
    currentCatalogCostPerSf,
    catalogCostChanged:quotedCostPerSf!==undefined&&currentCatalogCostPerSf!==undefined
      &&Math.abs(currentCatalogCostPerSf-quotedCostPerSf)>=0.005,
    materialType:reference?.snapshot?.materialType??material?.materialType,
  };
}
