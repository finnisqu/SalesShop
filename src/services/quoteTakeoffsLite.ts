import type { Quote, QuoteSection, QuoteTakeoffPiece, QuoteAreaScope } from '../types/quote';

/** Compatible with common shop dimensions: 25.5, 25 1/2, 25-1/2, 1/4, 25½. */
const unicodeFractions: Record<string,string> = {
  '¼':'1/4','½':'1/2','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8',
};
const maxDimensionIn=10000;
const maxPieceCount=1000;

export function parseInches(raw:string):number|undefined {
  let value=raw.trim().replace(/[″"]/g,'').trim();
  if(!value)return undefined;
  value=value.replace(/([\d])([¼½¾⅛⅜⅝⅞])/g,'$1 $2');
  value=value.replace(/[¼½¾⅛⅜⅝⅞]/g,char=>unicodeFractions[char]);
  let n:number;
  const mixed=value.match(/^(\d+(?:\.\d+)?)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/);
  const fractional=value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if(mixed) {
    const denominator=Number(mixed[3]);
    if(!denominator || Number(mixed[2])>=denominator)return undefined;
    n=Number(mixed[1])+Number(mixed[2])/denominator;
  }else if(fractional) {
    const denominator=Number(fractional[2]);
    if(!denominator)return undefined;
    n=Number(fractional[1])/denominator;
  }else if(/^\d+(?:\.\d+)?$/.test(value))n=Number(value);
  else return undefined;
  return Number.isFinite(n)&&n>0&&n<=maxDimensionIn?n:undefined;
}

export function isValidTakeoffPiece(piece: QuoteTakeoffPiece):boolean {
  return typeof piece.lengthIn==='number'&&Number.isFinite(piece.lengthIn)
    &&piece.lengthIn>0&&piece.lengthIn<=maxDimensionIn
    &&typeof piece.widthIn==='number'&&Number.isFinite(piece.widthIn)
    &&piece.widthIn>0&&piece.widthIn<=maxDimensionIn
    &&Number.isInteger(piece.count)&&piece.count>=1&&piece.count<=maxPieceCount;
}
export function takeoffPieceSf(piece: QuoteTakeoffPiece):number {
  return isValidTakeoffPiece(piece) ? piece.lengthIn!*piece.widthIn!*piece.count/144 : 0;
}
/** Sum unrounded rectangle areas before rounding to hundredths of a SF. */
export function totalTakeoffSf(pieces:QuoteTakeoffPiece[]):number {
  const total=pieces.reduce((acc,piece)=>acc+takeoffPieceSf(piece),0);
  return Math.round((total+Number.EPSILON)*100)/100;
}
export function newTakeoffPiece(index:number):QuoteTakeoffPiece {
  return {id:`takeoff_${crypto.randomUUID()}`,name:`Piece ${index}`,count:1};
}
export function takeoffOwnedScope(scope:QuoteAreaScope|undefined):boolean {
  return Array.isArray(scope?.takeoffPieces);
}
export function sectionTakeoffSf(section:QuoteSection):number|undefined {
  if(!takeoffOwnedScope(section.scope))return undefined;
  return totalTakeoffSf(section.scope!.takeoffPieces!);
}

/** A single atomic edit updates area SF and ONLY its explicitly live-linked
 * quote quantities. Manual quantities and legacy snapshots cannot drift. */
export function patchQuoteTakeoff(
  quote:Quote, sectionId:string, pieces:QuoteTakeoffPiece[], appliedAt=new Date().toISOString(),
):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section)return quote;
  const total=totalTakeoffSf(pieces);
  return {
    ...quote,
    sections:quote.sections.map(s=>s.id===sectionId
      ? {...s,scope:{...(s.scope??{}),takeoffPieces:pieces,countertopSf:total}}
      : s),
    lines:quote.lines.map(line=>{
      const source=line.quantitySource;
      if(line.sectionId!==sectionId||line.pricingMode!=='quantity-rate'
        ||source?.kind!=='area-scope'||source.sectionId!==sectionId
        ||source.field!=='countertopSf'||source.syncMode!=='live')return line;
      return {...line,quantity:total,quantitySource:{...source,capturedValue:total,appliedAt}};
    }),
  };
}

/** Explicitly return an Area to manually entered SF without losing its last
 * measured number or unexpectedly repricing a linked quantity. */
export function detachQuoteTakeoff(quote:Quote, sectionId:string):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section || !takeoffOwnedScope(section.scope))return quote;
  return {
    ...quote,
    sections:quote.sections.map(s=>{
      if(s.id!==sectionId)return s;
      const scope={...(s.scope??{})};
      delete scope.takeoffPieces;
      return {...s,scope};
    }),
    lines:quote.lines.map(line=>{
      const source=line.quantitySource;
      if(line.sectionId!==sectionId || source?.kind!=='area-scope'
        ||source.field!=='countertopSf'||source.sectionId!==sectionId||source.syncMode!=='live')return line;
      const {syncMode: _live, ...snapshot}=source;
      void _live;
      return {...line,quantitySource:snapshot};
    }),
  };
}
