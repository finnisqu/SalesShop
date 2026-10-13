/** Optional World Stone wording transcribed from the supplied quote template.
 * Stored as ordinary customerNotes paragraphs, which already sync to cloud
 * quotes and the customer document. Never place hidden JSON in customerNotes. */
export const QUOTE_STANDARD_TERMS=[
  {id:'included',title:'Included scope',text:
    'Price includes provision and installation of countertops, backsplashes and sinks; final field measurements, fabrication, delivery, installation, and a 1-year warranty.'},
  {id:'changes',title:'Lead time and scope changes',text:
    'Please check with your sales representative regarding lead time. Significant changes to countertop dimensions or project scope may affect pricing.'},
  {id:'trips',title:'Additional trips',text:
    'Additional trips caused by other trades or site conditions will incur a $150 trip charge.'},
  {id:'payment',title:'Payment terms',text:
    '100% payment is expected before materials are ordered. For projects over $20,000, a 50% deposit is expected and the balance is paid as the project is completed.'},
  {id:'natural',title:'Natural stone variation',text:
    'Natural stone is a product of nature and can vary in color, markings, and shading. Samples are indicative of average appearance only.'},
  {id:'validity',title:'30-day estimate validity',text:
    'THIS PROJECT ESTIMATE IS VALID FOR 30 DAYS.'},
] as const;
export type QuoteTermsKey=typeof QUOTE_STANDARD_TERMS[number]['id'];
const paragraphs=(text:string)=>text.split(/\n\s*\n/g).map(p=>p.trim()).filter(Boolean);
export function termsEnabled(notes:string,id:QuoteTermsKey){
  const term=QUOTE_STANDARD_TERMS.find(t=>t.id===id);
  return !!term&&paragraphs(notes).includes(term.text);
}
export function freeCustomerNotes(notes:string){
  const known=new Set<string>(QUOTE_STANDARD_TERMS.map(t=>t.text));
  return paragraphs(notes).filter(p=>!known.has(p)).join('\n\n');
}
export function withCustomerTerms(notes:string,ids:QuoteTermsKey[]){
  const free=freeCustomerNotes(notes);
  const terms=QUOTE_STANDARD_TERMS.filter(t=>ids.includes(t.id)).map(t=>t.text);
  return [free,...terms].filter(Boolean).join('\n\n');
}
export function toggleCustomerTerm(notes:string,id:QuoteTermsKey,enable:boolean){
  const active=QUOTE_STANDARD_TERMS.filter(t=>termsEnabled(notes,t.id)).map(t=>t.id);
  const next=enable?[...new Set([...active,id])]:active.filter(k=>k!==id);
  return withCustomerTerms(notes,next);
}
