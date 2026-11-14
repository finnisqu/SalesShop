import {
 quoteLineAmount,quoteLinesTotal,roundCurrency,
 type PricingScheduleItem,type QuoteLine,type QuoteSection,
} from '../types/quote';

/** A signed receipt must NEVER store the full private QuoteLine or Area
 * scope. Keep a strict allowlist of customer-facing selling fields.
 * Hidden billed work is rolled into a visible charge (or an anonymous
 * Included work row), so the receipt rows reconcile to the signed total. */
export function customerReceiptLines(
 lines:readonly QuoteLine[],sections:readonly QuoteSection[],
):QuoteLine[]{
 const hiddenSections=new Set(sections.filter(s=>!s.customerVisible).map(s=>s.id));
 // Reconcile each Area independently. A hidden bathroom cost must never be
 // merged into a visible kitchen price merely because the kitchen comes first.
 const grouped=new Map<string,QuoteLine[]>();
 for(const line of lines){
  const key=line.sectionId??'';
  const rows=grouped.get(key)??[];
  rows.push(line);grouped.set(key,rows);
 }
 const result:QuoteLine[]=[];
 let anonymousRow=0;
 for(const [sectionId,areaLines] of grouped){
  const sectionVisible=!sectionId||!hiddenSections.has(sectionId);
  const projected:QuoteLine[]=areaLines
   .filter(line=>sectionVisible&&line.customerVisible&&
    (line.includeInTotal||line.pricingMode==='none'))
   .map(line=>({
    id:line.id,sectionId:line.sectionId,kind:line.kind,
    description:line.description,pricingMode:line.pricingMode,
    quantity:line.quantity,rate:line.rate,amount:line.amount,
    customerVisible:true,includeInTotal:line.includeInTotal,
   }));
  const hiddenAmount=roundCurrency(quoteLinesTotal(areaLines)-quoteLinesTotal(projected));
  if(hiddenAmount!==0){
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
     id:'accepted-included-work-'+(++anonymousRow),
     // A hidden Area must not reveal its identity in the customer receipt.
     ...(sectionVisible&&sectionId?{sectionId}:{}),
     kind:'item',description:'Included work',
     pricingMode:'direct',amount:hiddenAmount,
     customerVisible:true,includeInTotal:true,
    });
   }
  }
  result.push(...projected);
 }
 return result;
}

export function customerReceiptSections(sections:readonly QuoteSection[]):QuoteSection[]{
 return sections.filter(section=>section.customerVisible).map(section=>({
  id:section.id,title:section.title,customerVisible:true,
  customerDisplayMode:section.customerDisplayMode,
 }));
}

/** Imported pricing schedules can contain private workbook metadata at runtime.
 * Sign only known customer-display fields, never an imported row wholesale. */
export function customerReceiptScheduleItems(
 items:readonly PricingScheduleItem[],
):PricingScheduleItem[]{
 return items.map(item=>({
  sourceRow:item.sourceRow,
  series:item.series,itemType:item.itemType,
  planNumber:item.planNumber,planName:item.planName,
  optionCode:item.optionCode,description:item.description,
  customerPrice:item.customerPrice,displayType:item.displayType,
  groupLabel:item.groupLabel,priceLabel:item.priceLabel,
  unitLabel:item.unitLabel,detailsLayout:item.detailsLayout,
  colors:Array.isArray(item.colors)
   ?item.colors.filter((value):value is string=>typeof value==='string'):undefined,
  details:Array.isArray(item.details)
   ?item.details.filter((value):value is string=>typeof value==='string'):undefined,
 }));
}
