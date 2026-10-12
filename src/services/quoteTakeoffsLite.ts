import type { Quote, QuoteSection, QuoteTakeoffPiece, QuoteAreaScope, QuoteTakeoffSink, QuoteLine, QuoteLineMaterialReference, QuoteProjectMaterial } from '../types/quote';

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
/** All geometry is summed before rounding, so small pieces retain their SF. */
const roundSf=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function splashEdgeInches(piece:QuoteTakeoffPiece):number {
  if(!isValidTakeoffPiece(piece))return 0;
  const edges=(piece.backsplash?piece.lengthIn!:0)
    +(piece.leftSplash?piece.widthIn!:0)+(piece.rightSplash?piece.widthIn!:0);
  return edges*piece.count;
}
/** 4-inch splash material: (4 × chosen edge inches × piece count) / 144. */
export function takeoffPieceSplashSf(piece:QuoteTakeoffPiece):number {
  return splashEdgeInches(piece)*4/144;
}
export function takeoffPieceTotalSf(piece:QuoteTakeoffPiece):number {
  return takeoffPieceSf(piece)+takeoffPieceSplashSf(piece);
}
export function totalTakeoffSf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+takeoffPieceSf(piece),0));
}
export function totalSplashLf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+splashEdgeInches(piece),0)/12);
}
export function totalSplashSf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+takeoffPieceSplashSf(piece),0));
}
/** Single billable SF quantity: tops + 4-inch splash material, rounded once. */
export function totalBillableTakeoffSf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+takeoffPieceTotalSf(piece),0));
}
export function newTakeoffSink():QuoteTakeoffSink {
  return {id:`sinktakeoff_${crypto.randomUUID()}`,category:'kitchen',name:'',count:1,
    includeInPricing:false};
}
export function takeoffCustomerSpecs(section:QuoteSection):string {
  const material=section.scope?.takeoffMaterial?.trim()??'';
  const sinks=(section.scope?.takeoffSinks??[])
    .filter(s=>s.count>0)
    .map(s=>`${s.count} × ${s.name.trim()|| (s.category==='vanity'?'Vanity sink':'Kitchen sink')}`);
  const elements=[material,...sinks].filter(Boolean);
  return elements.join(' · ');
}
/** Sink rows are explicitly opted in to pricing. Existing manual sink rows
 * and catalog sink selections are NEVER modified or deleted. */
export function patchQuoteTakeoffSinks(quote:Quote,sectionId:string,sinks:QuoteTakeoffSink[]):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section)return quote;
  const timestamp=new Date().toISOString();
  const managedExisting=quote.lines.filter(line=>line.sectionId===sectionId&&line.takeoffSinkId);
  const keepIds=new Set(sinks.filter(s=>s.includeInPricing).map(s=>s.id));
  const lines=quote.lines.filter(line=>!line.takeoffSinkId
    || line.sectionId!==sectionId || keepIds.has(line.takeoffSinkId));
  for(const sink of sinks){
    if(!sink.includeInPricing)continue;
    const existing=managedExisting.find(line=>line.takeoffSinkId===sink.id);
    const line:QuoteLine={
      id:existing?.id??`line_${crypto.randomUUID()}`,
      sectionId,kind:sink.sinkReference?.snapshot?'sink':'item',
      description:`Sink · ${sink.name.trim()|| (sink.category==='vanity'?'Vanity sink':'Kitchen sink')}`,
      pricingMode:'quantity-rate',quantity:sink.count,rate:sink.unitPrice,
      customerVisible:true,includeInTotal:true,
      sinkReference:sink.sinkReference,
      takeoffSinkId:sink.id,
    };
    const index=lines.findIndex(item=>item.id===line.id);
    if(index>=0)lines[index]={...lines[index],...line};
    else lines.push(line);
  }
  return {...quote,
    sections:quote.sections.map(s=>s.id===sectionId
      ?{...s,scope:{...(s.scope??{}),takeoffSinks:sinks,
        kitchenSinkCount:sinks.reduce((n,sink)=>n+(sink.category==='kitchen'?sink.count:0),0),
        vanitySinkCount:sinks.reduce((n,sink)=>n+(sink.category==='vanity'?sink.count:0),0)}}:s),
    lines,updatedAt:timestamp};
}

/** Keep a catalog selection (or a free-text material) tied to Area scope.
 * Only the Area's explicit live takeoff SF rows receive the new catalog
 * material snapshot; manual material rows and selling rates are untouched. */
export function patchQuoteTakeoffMaterial(
  quote:Quote,sectionId:string,label:string,reference?:QuoteLineMaterialReference,
):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section)return quote;
  return {...quote,
    sections:quote.sections.map(s=>s.id===sectionId
      ? {...s,scope:{...(s.scope??{}),takeoffMaterial:label,
          takeoffMaterialReference:reference}}:s),
    lines:quote.lines.map(line=>{
      const src=line.quantitySource;
      if(line.sectionId!==sectionId||src?.field!=='countertopSf'
        ||src?.syncMode!=='live'||src.sectionId!==sectionId)return line;
      return {...line,
        kind:reference?'material':'item',
        description:label.trim()||`Countertop and 4″ splash SF · ${section.title}`,
        materialReference:reference,
      };
    }),
  };
}

export function newTakeoffPiece(index:number):QuoteTakeoffPiece {
  void index;
  return {id:`takeoff_${crypto.randomUUID()}`,name:'',count:1};
}
export function takeoffOwnedScope(scope:QuoteAreaScope|undefined):boolean {
  return Array.isArray(scope?.takeoffPieces);
}
export function sectionTakeoffSf(section:QuoteSection):number|undefined {
  if(!takeoffOwnedScope(section.scope))return undefined;
  return totalBillableTakeoffSf(section.scope!.takeoffPieces!);
}

/** A single atomic edit updates tops + 4-inch splash SF and ONLY its live-linked
 * quote quantities. Manual quantities and legacy snapshots cannot drift. */
export function patchQuoteTakeoff(
  quote:Quote, sectionId:string, pieces:QuoteTakeoffPiece[], appliedAt=new Date().toISOString(),
):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section)return quote;
  const topSf=totalTakeoffSf(pieces);
  const splashSf=totalSplashSf(pieces);
  const total=totalBillableTakeoffSf(pieces);
  const splash=totalSplashLf(pieces);
  return {
    ...quote,
    sections:quote.sections.map(s=>s.id===sectionId
      ? {...s,scope:{...(s.scope??{}),takeoffPieces:pieces,
        countertopSf:total,takeoffTopSf:topSf,takeoffSplashSf:splashSf,splashLf:splash}}
      : s),
    lines:quote.lines.map(line=>{
      const source=line.quantitySource;
      if(line.sectionId!==sectionId||line.pricingMode!=='quantity-rate'
        ||source?.kind!=='area-scope'||source.sectionId!==sectionId
        ||(source.field!=='countertopSf'&&source.field!=='splashLf')||source.syncMode!=='live')return line;
      const quantity=source.field==='splashLf'?splash:total;
      return {...line,quantity,quantitySource:{...source,capturedValue:quantity,appliedAt}};
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
      // Retain last measured countertop and splash quantities on manual conversion.
      return {...s,scope};
    }),
    lines:quote.lines.map(line=>{
      const source=line.quantitySource;
      if(line.sectionId!==sectionId || source?.kind!=='area-scope'
        ||(source.field!=='countertopSf'&&source.field!=='splashLf')||source.sectionId!==sectionId||source.syncMode!=='live')return line;
      const {syncMode: _live, ...snapshot}=source;
      void _live;
      return {...line,quantitySource:snapshot};
    }),
  };
}

/** A smart row is a normal quote line plus live quantity/reference metadata;
 * never replace manual rows or create duplicate SF rows. */
export function ensureSmartTakeoffLine(quote:Quote,sectionId:string):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section || !takeoffOwnedScope(section.scope)
    || !section.scope?.takeoffPieces?.some(isValidTakeoffPiece))return quote;
  const linked=quote.lines.some(l=>l.sectionId===sectionId
    &&l.quantitySource?.field==='countertopSf'&&l.quantitySource.syncMode==='live');
  if(linked)return quote;
  const quantity=sectionTakeoffSf(section)??0;
  const line:QuoteLine={
    id:`line_${crypto.randomUUID()}`,sectionId,
    kind:section.scope?.takeoffMaterialReference?'material':'item',
    description:section.scope?.takeoffMaterial?.trim()||`Countertop & 4″ splash · ${section.title}`,
    pricingMode:'quantity-rate',quantity,rate:undefined,
    customerVisible:true,includeInTotal:true,
    materialReference:section.scope?.takeoffMaterialReference,
    quantitySource:{kind:'area-scope',sectionId,field:'countertopSf',
      capturedValue:quantity,appliedAt:new Date().toISOString(),syncMode:'live'},
  };
  return {...quote,lines:[...quote.lines,line]};
}

export function upsertProjectMaterial(
  quote:Quote,label:string,reference?:QuoteLineMaterialReference,
):Quote {
  const name=label.trim().slice(0,300);
  if(!name)return quote;
  const previous=quote.projectMaterials??[];
  const found=previous.find(m=>
    reference?.materialId
      ? m.reference?.materialId===reference.materialId&&m.reference?.variantId===reference.variantId
      : m.label.toLowerCase()===name.toLowerCase());
  if(found)return quote;
  const material:QuoteProjectMaterial={id:`pm_${crypto.randomUUID()}`,label:name,reference};
  return {...quote,projectMaterials:[...previous,material]};
}

/** Move selected measured pieces into a new priced Area, preserving sink and
 * other current-Area rows; split linked SF quantity without duplicating it. */
export function splitTakeoffPieces(
  quote:Quote,sourceId:string,pieceIds:string[],title:string,
):Quote {
  const source=quote.sections.find(section=>section.id===sourceId);
  if(!source?.scope?.takeoffPieces?.length||!pieceIds.length)return quote;
  const picked=new Set(pieceIds);
  const moving=source.scope.takeoffPieces.filter(p=>picked.has(p.id));
  if(!moving.length||moving.length===source.scope.takeoffPieces.length)return quote;
  const remaining=source.scope.takeoffPieces.filter(p=>!picked.has(p.id));
  const id=`section_${crypto.randomUUID()}`;
  const newArea:QuoteSection={
    id,title:title.trim()||'New area',customerVisible:true,customerDisplayMode:'summary',
    scope:{takeoffPieces:[],takeoffMaterial:source.scope.takeoffMaterial,
      takeoffMaterialReference:source.scope.takeoffMaterialReference},
  };
  const initial={...quote,sections:[...quote.sections,newArea]};
  const updated=patchQuoteTakeoff(patchQuoteTakeoff(initial,sourceId,remaining),id,moving);
  const ready=ensureSmartTakeoffLine(updated,id);
  const oldLive=ready.lines.find(line=>line.sectionId===sourceId
    &&line.quantitySource?.field==='countertopSf'&&line.quantitySource.syncMode==='live');
  const rate=oldLive?.rate;
  if(rate===undefined)return ready;
  return {...ready,lines:ready.lines.map(line=>{
    if(line.sectionId!==id||line.quantitySource?.field!=='countertopSf'
      ||line.quantitySource.syncMode!=='live')return line;
    return {...line,rate,rateReference:oldLive.rateReference};
  })};
}
