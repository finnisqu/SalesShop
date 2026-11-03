import type { Quote, QuoteSection, QuoteTakeoffPiece, QuoteAreaScope, QuoteTakeoffSink, QuoteLine, QuoteLineMaterialReference, QuoteProjectMaterial, QuoteSplashEdge } from '../types/quote';

/** Compatible with common shop dimensions: 25.5, 25 1/2, 25-1/2, 1/4, 25½. */
const unicodeFractions: Record<string,string> = {
  '¼':'1/4','½':'1/2','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8',
};
const maxDimensionIn=10000;
const maxPieceCount=1000;
export const DEFAULT_SPLASH_HEIGHT_IN=4;
export const DEFAULT_EDGE_PROFILE='Flat';
export const FAUCET_HOLE_OFFSETS_IN=[-8,-6,-4,-2,0,2,4,6,8] as const;
export const DEFAULT_FAUCET_HOLE_OFFSETS_IN=[0] as const;

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
const splashFlagByEdge:Record<QuoteSplashEdge,'backsplash'|'leftSplash'|'rightSplash'>={
  back:'backsplash',left:'leftSplash',right:'rightSplash'
};
export const QUOTE_SPLASH_EDGES=['back','left','right'] as const;

/** Measured edge length includes quantity. Independent edge rows use this in L. */
export function takeoffSplashEdgeLengthIn(piece:QuoteTakeoffPiece,edge:QuoteSplashEdge):number {
  if(!isValidTakeoffPiece(piece)||!piece[splashFlagByEdge[edge]])return 0;
  return (edge==='back'?piece.lengthIn!:piece.widthIn!)*piece.count;
}
export function isSplashEdgeExcluded(piece:QuoteTakeoffPiece,edge:QuoteSplashEdge):boolean {
  return !!piece.excludedFromQuote||!!piece.excludeSplashFromQuote||!!piece.excludedSplashEdges?.[edge];
}
export function takeoffSplashEdgeHeightIn(piece:QuoteTakeoffPiece,edge:QuoteSplashEdge):number {
  return piece.splashEdgeHeightsIn?.[edge]??piece.splashHeightIn??DEFAULT_SPLASH_HEIGHT_IN;
}
export function takeoffPieceSplashEdgeSf(piece:QuoteTakeoffPiece,edge:QuoteSplashEdge):number {
  const height=takeoffSplashEdgeHeightIn(piece,edge);
  return Number.isFinite(height)&&height>=0&&height<=120
    ?takeoffSplashEdgeLengthIn(piece,edge)*height/144:0;
}
function splashEdgeInches(piece:QuoteTakeoffPiece,onlyBillable=false):number {
  return QUOTE_SPLASH_EDGES.reduce((sum,edge)=>
    sum+(onlyBillable&&isSplashEdgeExcluded(piece,edge)?0:takeoffSplashEdgeLengthIn(piece,edge)),0);
}
/** Exact physical splash geometry, including retained excluded edges. */
export function takeoffPieceSplashSf(piece:QuoteTakeoffPiece):number {
  return QUOTE_SPLASH_EDGES.reduce((sum,edge)=>sum+takeoffPieceSplashEdgeSf(piece,edge),0);
}
/** Billable only: an excluded splash edge retains geometry but is not priced. */
export function takeoffPieceBillableSplashSf(piece:QuoteTakeoffPiece):number {
  return QUOTE_SPLASH_EDGES.reduce((sum,edge)=>
    sum+(isSplashEdgeExcluded(piece,edge)?0:takeoffPieceSplashEdgeSf(piece,edge)),0);
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
/** Explicit fabrication edges only. Edges on excluded pieces do not bill; their
 * measured geometry remains stored for later revisions. */
export function takeoffPieceMiterInches(piece:QuoteTakeoffPiece):number {
 if(!isValidTakeoffPiece(piece))return 0;
 return ((piece.miterFront?piece.lengthIn!:0)+
   (piece.miterLeft?piece.widthIn!:0)+(piece.miterRight?piece.widthIn!:0))*piece.count;
}
export function totalBillableMiterInches(pieces:QuoteTakeoffPiece[]):number {
 return Math.round(pieces.reduce((sum,piece)=>sum+
   (piece.excludedFromQuote?0:takeoffPieceMiterInches(piece)),0)*100)/100;
}
export function totalSplashSf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+takeoffPieceSplashSf(piece),0));
}
/** Single billable SF quantity: tops + 4-inch splash material, rounded once. */
export function totalBillableTakeoffSf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+(piece.excludedFromQuote?0:
    takeoffPieceSf(piece)+takeoffPieceBillableSplashSf(piece)),0));
}
/** Selling quantity only; internal shop and slab costs continue using precise SF. */
export function roundedBillableTakeoffSf(pieces:QuoteTakeoffPiece[],
 mode:QuoteAreaScope['billableSfRounding']='exact'):number {
 const raw=totalBillableTakeoffSf(pieces);
 const step=mode==='quarter-up'?0.25:mode==='half-up'?0.5:mode==='whole-up'?1:0;
 return step?Math.round((Math.ceil((raw-1e-8)/step)*step+Number.EPSILON)*100)/100:raw;
}
/** Quoted splash linear feet: retained but struck-through splashes stay out of the active price. */
export function totalBillableSplashLf(pieces:QuoteTakeoffPiece[]):number {
  return roundSf(pieces.reduce((acc,piece)=>acc+splashEdgeInches(piece,true),0)/12);
}
export function newTakeoffSink():QuoteTakeoffSink {
  return {id:`sinktakeoff_${crypto.randomUUID()}`,category:'kitchen',name:'',count:1,
    includeInPricing:true,faucetHoleOffsetsIn:[0]};
}
/** Customer-facing material and fixture selections only. Never expose internal
 * measurements, labor assumptions, takeoff pricing or supplier cost. */
export function takeoffCustomerDetails(section:QuoteSection):{
  material:string;
  sinks:string[];
} {
  return {
    material:section.scope?.takeoffMaterial?.trim()??'',
    sinks:(section.scope?.takeoffSinks??[])
      .filter(sink=>!sink.excludedFromContract&&Number.isFinite(sink.count)&&sink.count>0)
      .map(sink=>`${sink.count} × ${sink.name.trim()||
        (sink.category==='vanity'?'Vanity sink':'Kitchen sink')}`),
  };
}
/** Retain the compact string form for older presentation consumers. */
export function takeoffCustomerSpecs(section:QuoteSection):string {
  const {material,sinks}=takeoffCustomerDetails(section);
  return [material,...sinks].filter(Boolean).join(' · ');
}
/** Legacy sinks can have no managed charge or an excluded charge. */
export function takeoffSinkIncludedInQuote(quote:Quote,sectionId:string,sinkId:string):boolean {
  const sink=quote.sections.find(s=>s.id===sectionId)?.scope?.takeoffSinks?.find(s=>s.id===sinkId);
  if(!sink?.includeInPricing)return false;
  return quote.lines.some(line=>line.sectionId===sectionId&&line.takeoffSinkId===sinkId&&line.includeInTotal);
}

/** Explicit, one-operation seller opt-in/out of a sink charge. */
export function setQuoteTakeoffSinkCharge(quote:Quote,sectionId:string,sinkId:string,include:boolean):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  const sinks=section?.scope?.takeoffSinks;
  if(!sinks?.some(s=>s.id===sinkId))return quote;
  const next=patchQuoteTakeoffSinks(quote,sectionId,
    sinks.map(s=>s.id===sinkId?{...s,includeInPricing:include}:s),
    include?new Set([sinkId]):undefined);
  if(!include)return next;
  return {...next,lines:next.lines.map(line=>
    line.sectionId===sectionId&&line.takeoffSinkId===sinkId
      ?{...line,includeInTotal:true}:line)};
}

/** Sink rows are explicitly opted in to pricing. Existing manual sink rows
 * and catalog sink selections are NEVER modified or deleted. */
export function patchQuoteTakeoffSinks(quote:Quote,sectionId:string,sinks:QuoteTakeoffSink[],explicitIncludedIds?:ReadonlySet<string>):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section)return quote;
  const timestamp=new Date().toISOString();
  const managedExisting=quote.lines.filter(line=>line.sectionId===sectionId&&line.takeoffSinkId);
  // A deliberately struck-through sink keeps its existing, inactive line
  // ID so normalized cloud sync cannot resurrect a stale charge on reload.
  // Legacy specifications-only sinks still never create billable lines.
  const keepIds=new Set(sinks.filter(s=>s.includeInPricing||s.excludedFromContract).map(s=>s.id));
  const lines=quote.lines.filter(line=>!line.takeoffSinkId
    || line.sectionId!==sectionId || keepIds.has(line.takeoffSinkId));
  for(const sink of sinks){
    const existing=managedExisting.find(line=>line.takeoffSinkId===sink.id);
    if(!sink.includeInPricing){
      if(sink.excludedFromContract&&existing){
        const index=lines.findIndex(item=>item.id===existing.id);
        if(index>=0)lines[index]={...existing,quantity:sink.count,rate:sink.unitPrice,
          includeInTotal:false,customerVisible:false};
      }
      continue;
    }
    // Editing a saved legacy sink without a managed line cannot create a bill.
    const previous=section.scope?.takeoffSinks?.find(old=>old.id===sink.id);
    if(!existing&&previous?.includeInPricing&&!explicitIncludedIds?.has(sink.id))continue;
    const line:QuoteLine={
      id:existing?.id??`line_${crypto.randomUUID()}`,
      sectionId,kind:sink.sinkReference?.snapshot?'sink':'item',
      description:`Sink · ${sink.name.trim()|| (sink.category==='vanity'?'Vanity sink':'Kitchen sink')}`,
      pricingMode:'quantity-rate',quantity:sink.count,rate:sink.unitPrice,
      // An itemization choice is independent of editing sink quantities or prices.
      customerVisible:existing?.customerVisible??false,
      includeInTotal:existing?.includeInTotal??true,
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

/** Sync a separately edited Takeoffs-managed sink row back into the Area.
 * Regular quote pricing is editable, so the popup must not silently revert it. */
export function syncManagedSinkLineEdit(
  quote:Quote,lineId:string,patch:Partial<QuoteLine>,
):Quote {
  const original=quote.lines.find(line=>line.id===lineId);
  if(!original?.takeoffSinkId || !original.sectionId)return quote;
  const keys=['quantity','rate','description','sinkReference'] as const;
  if(!keys.some(key=>Object.prototype.hasOwnProperty.call(patch,key)))return quote;
  const updated={...original,...patch};
  return {...quote,sections:quote.sections.map(section=>section.id===original.sectionId
    &&section.scope?.takeoffSinks
    ? {...section,scope:{...section.scope,takeoffSinks:section.scope.takeoffSinks.map(sink=>
      sink.id!==original.takeoffSinkId?sink:{
        ...sink,
        ...(Object.prototype.hasOwnProperty.call(patch,'rate')
          ?{unitPrice:typeof updated.rate==='number'&&Number.isFinite(updated.rate)&&updated.rate>=0
            ?updated.rate:undefined}:{}),
        ...(Object.prototype.hasOwnProperty.call(patch,'quantity')
          &&Number.isInteger(updated.quantity)&&(updated.quantity??0)>=1&&(updated.quantity??0)<=1000
          ?{count:updated.quantity!}:{}),
        ...(Object.prototype.hasOwnProperty.call(patch,'description')
          ?{name:updated.description.replace(/^Sink\s*·\s*/i,'')}:{}),
        ...(Object.prototype.hasOwnProperty.call(patch,'sinkReference')
          ?{sinkReference:updated.sinkReference}:{}),
      })}}:section)};
}

/** Deleting a managed sink charge in normal Quotes leaves the sink
 * specification in Takeoffs, but prevents an unwanted charge reappearing. */
export function unpriceDeletedTakeoffSink(quote:Quote,lineId:string):Quote {
  const line=quote.lines.find(item=>item.id===lineId);
  if(!line?.takeoffSinkId || !line.sectionId)return quote;
  return {...quote,sections:quote.sections.map(section=>
    section.id===line.sectionId && section.scope?.takeoffSinks
      ? {...section,scope:{...section.scope,takeoffSinks:section.scope.takeoffSinks.map(sink=>
        sink.id===line.takeoffSinkId?{...sink,includeInPricing:false}:sink)}}
      : section)};
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
  return {id:`takeoff_${crypto.randomUUID()}`,name:'',count:1,splashHeightIn:DEFAULT_SPLASH_HEIGHT_IN,edgeProfile:DEFAULT_EDGE_PROFILE};
}
export function takeoffOwnedScope(scope:QuoteAreaScope|undefined):boolean {
  return Array.isArray(scope?.takeoffPieces);
}
export function sectionTakeoffSf(section:QuoteSection):number|undefined {
  if(!takeoffOwnedScope(section.scope))return undefined;
  return roundedBillableTakeoffSf(section.scope!.takeoffPieces!,section.scope?.billableSfRounding);
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
  const total=roundedBillableTakeoffSf(pieces,section.scope?.billableSfRounding);
  const splash=totalBillableSplashLf(pieces);
  const miter=totalBillableMiterInches(pieces);
  return {
    ...quote,
    sections:quote.sections.map(s=>s.id===sectionId
      ? {...s,scope:{...(s.scope??{}),takeoffPieces:pieces,
        countertopSf:total,takeoffTopSf:topSf,takeoffSplashSf:splashSf,splashLf:splash,miterInches:miter}}
      : s),
    lines:quote.lines.map(line=>{
      const source=line.quantitySource;
      if(line.sectionId!==sectionId||line.pricingMode!=='quantity-rate'
        ||source?.kind!=='area-scope'||source.sectionId!==sectionId
        ||(source.field!=='countertopSf'&&source.field!=='splashLf'&&source.field!=='miterInches')||source.syncMode!=='live')return line;
      const quantity=source.field==='splashLf'?splash:source.field==='miterInches'?miter:total;
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
        ||(source.field!=='countertopSf'&&source.field!=='splashLf'&&source.field!=='miterInches')||source.sectionId!==sectionId||source.syncMode!=='live')return line;
      const {syncMode: _live, ...snapshot}=source;
      void _live;
      return {...line,quantitySource:snapshot};
    }),
  };
}

/** A smart row is a normal quote line plus live quantity/reference metadata;
 * never replace manual rows or create duplicate SF rows. */
export function ensureSmartTakeoffLine(quote:Quote,sectionId:string,force=false):Quote {
  const section=quote.sections.find(s=>s.id===sectionId);
  if(!section || !takeoffOwnedScope(section.scope)
    || !section.scope?.takeoffPieces?.some(isValidTakeoffPiece))return quote;
  const linked=quote.lines.some(l=>l.sectionId===sectionId
    &&l.quantitySource?.field==='countertopSf'&&l.quantitySource.syncMode==='live');
  if(linked)return quote;
  // Never auto-add a second material charge to an Area that already has
  // manually priced material/items; the user may opt in explicitly instead.
  if(!force&&quote.lines.some(l=>l.sectionId===sectionId&&l.includeInTotal
    &&(l.kind==='material'||l.kind==='item')&&l.pricingMode!=='none'))return quote;
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
  if(!moving.length)return quote;
  const remaining=source.scope.takeoffPieces.filter(p=>!picked.has(p.id));
  const id=`section_${crypto.randomUUID()}`;
  const newArea:QuoteSection={
    id,title:title.trim()||'New area',customerVisible:true,customerDisplayMode:'detail',
    scope:{takeoffPieces:[],takeoffMaterial:source.scope.takeoffMaterial,
      takeoffMaterialReference:source.scope.takeoffMaterialReference},
  };
  const initial={...quote,sections:[...quote.sections,newArea]};
  const updated=patchQuoteTakeoff(patchQuoteTakeoff(initial,sourceId,remaining),id,moving);
  const ready=ensureSmartTakeoffLine(updated,id);
  const oldLive=ready.lines.find(line=>line.sectionId===sourceId
    &&line.quantitySource?.field==='countertopSf'&&line.quantitySource.syncMode==='live');
  const newLive=ready.lines.find(line=>line.sectionId===id
    &&line.quantitySource?.field==='countertopSf'&&line.quantitySource.syncMode==='live');
  // Moving *every* piece should not leave an empty charged SF row behind.
  // Remove the old managed row only after the new Area has a valid replacement.
  // Other manual/sink rows in the original Area remain untouched.
  const noPiecesLeft=remaining.length===0;
  const lines=ready.lines.filter(line=>!(noPiecesLeft&&oldLive&&newLive&&line.id===oldLive.id));
  if(!oldLive||!newLive)return {...ready,lines};
  return {...ready,lines:lines.map(line=>{
    if(line.id!==newLive.id)return line;
    return {...line,rate:oldLive.rate,rateReference:oldLive.rateReference,
      customerVisible:oldLive.customerVisible,includeInTotal:oldLive.includeInTotal};
  })};
}
