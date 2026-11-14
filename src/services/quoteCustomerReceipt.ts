import {
 quoteLineAmount,quoteLinesTotal,roundCurrency,
 type QuoteLine,type QuoteSection,
} from '../types/quote';

/** A signed receipt must NEVER store the full private QuoteLine or Area
 * scope. Keep a strict allowlist of customer-facing selling fields.
 * Hidden billed work is rolled into a visible charge (or an anonymous
 * Included work row), so the receipt rows reconcile to the signed total. */
export function customerReceiptLines(
 lines:readonly QuoteLine[],sections:readonly QuoteSection[],
):QuoteLine[]{
 const hiddenSections=new Set(sections.filter(s=>!s.customerVisible).map(s=>s.id));
 const projected:QuoteLine[]=lines
  .filter(line=>
   line.customerVisible&&(!line.sectionId||!hiddenSections.has(line.sectionId))&&
   (line.includeInTotal||line.pricingMode==='none'))
  .map(line=>({
   id:line.id,sectionId:line.sectionId,kind:line.kind,
   description:line.description,pricingMode:line.pricingMode,
   quantity:line.quantity,rate:line.rate,amount:line.amount,
   customerVisible:true,includeInTotal:line.includeInTotal,
  }));
 const hiddenAmount=roundCurrency(quoteLinesTotal([...lines])-quoteLinesTotal(projected));
 if(hiddenAmount===0)return projected;
 const host=projected.findIndex(line=>line.includeInTotal&&
  line.pricingMode!=='none'&&(line.kind==='material'||line.kind==='item'));
 const fallback=host>=0?host:projected.findIndex(line=>
  line.includeInTotal&&line.pricingMode!=='none'&&line.kind!=='discount');
 if(fallback>=0){
  const line=projected[fallback];
  projected[fallback]={
   ...line,pricingMode:'direct',
   quantity:undefined,rate:undefined,
   amount:roundCurrency(quoteLineAmount(line)+hiddenAmount),
  };
 }else{
  projected.push({
   id:'accepted-included-work',kind:'item',description:'Included work',
   pricingMode:'direct',amount:hiddenAmount,
   customerVisible:true,includeInTotal:true,
  });
 }
 return projected;
}

export function customerReceiptSections(sections:readonly QuoteSection[]):QuoteSection[]{
 return sections.filter(section=>section.customerVisible).map(section=>({
  id:section.id,title:section.title,customerVisible:true,
  customerDisplayMode:section.customerDisplayMode,
 }));
}
