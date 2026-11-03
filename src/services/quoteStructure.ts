import type { Quote, QuoteLine } from '../types/quote';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';

/**
 * Presentation-independent quote ordering. All transformations preserve line
 * identities, quoted prices, catalog snapshots and the overall quote total.
 */
export function reorderQuoteLine(quote: Quote, lineId: string, direction: -1 | 1): Quote {
  const index = quote.lines.findIndex(line => line.id === lineId);
  if (index < 0 || (direction !== -1 && direction !== 1)) return quote;
  const selected = quote.lines[index];
  const peers = quote.lines.filter(line => line.sectionId === selected.sectionId);
  const peerIndex = peers.findIndex(line => line.id === lineId);
  const neighbor = peers[peerIndex + direction];
  if (!neighbor) return quote;
  const neighborIndex = quote.lines.findIndex(line => line.id === neighbor.id);
  const lines = [...quote.lines];
  [lines[index], lines[neighborIndex]] = [lines[neighborIndex], lines[index]];
  return { ...quote, lines };
}

/**
 * Managed sink charges and live SF charges belong to the takeoff that generates
 * them. Moving them by themselves would silently break pricing synchronization.
 * Captured/manual quantity links may move, retaining their frozen quantity but
 * dropping the no-longer-valid Area source reference.
 */
export function moveQuoteLineToArea(quote: Quote, lineId: string, sectionId?: string): Quote {
  if (sectionId && !quote.sections.some(section => section.id === sectionId)) return quote;
  const source = quote.lines.find(line => line.id === lineId);
  if (!source || source.sectionId === sectionId || source.takeoffSinkId ||
      source.quantitySource?.syncMode === 'live') return quote;
  const lines = quote.lines.filter(line => line.id !== lineId);
  const moved: QuoteLine = { ...source, sectionId, quantitySource: undefined };
  const lastPeerIndex = lines.reduce((last, line, index) =>
    line.sectionId === sectionId ? index : last, -1);
  lines.splice(lastPeerIndex < 0 ? lines.length : lastPeerIndex + 1, 0, moved);
  return { ...quote, lines };
}

/** Classic parity: removing an Area retains its priced lines in General. */
export function deleteQuoteAreaToGeneral(quote: Quote, sectionId: string): Quote {
  if (!quote.sections.some(section => section.id === sectionId)) return quote;
  return {
    ...quote,
    sections: quote.sections.filter(section => section.id !== sectionId),
    lines: quote.lines.map(line => line.sectionId !== sectionId ? line : {
      ...line,
      sectionId: undefined,
      quantitySource: undefined,
      // The takeoff sink is removed with the Area. Retain its frozen line
      // price in General, but never leave a dangling "managed" sink handle.
      takeoffSinkId: undefined,
    }),
  };
}

/** Deliberate destructive choice: remove the Area and every quote row it owns. */
export function deleteQuoteAreaWithContents(quote: Quote, sectionId: string): Quote {
  if (!quote.sections.some(section => section.id === sectionId)) return quote;
  return {
    ...quote,
    sections: quote.sections.filter(section => section.id !== sectionId),
    lines: quote.lines.filter(line => line.sectionId !== sectionId),
  };
}

/** Commit the reorder panel in one atomic undoable change, never partial movement. */
export function setQuoteAreaOrder(quote: Quote, orderedIds: string[]): Quote {
  const originalIds = quote.sections.map(section => section.id);
  if (originalIds.length !== orderedIds.length ||
    orderedIds.some(id => !originalIds.includes(id)) ||
    new Set(orderedIds).size !== originalIds.length ||
    originalIds.every((id, i) => id === orderedIds[i])) return quote;
  const byId = new Map(quote.sections.map(section => [section.id, section]));
  return { ...quote, sections: orderedIds.map(id => byId.get(id)!) };
}


/** Reorder the loose / General line slots without disturbing Area-owned rows. */
export function setQuoteGeneralLineOrder(quote: Quote, ids: string[]): Quote {
  const sectionIds=new Set(quote.sections.map(section=>section.id));
  const isGeneral=(line:QuoteLine)=>!line.sectionId||!sectionIds.has(line.sectionId);
  const original=quote.lines.filter(isGeneral);
  const prior=original.map(line=>line.id);
  if(prior.length!==ids.length || new Set(ids).size!==ids.length ||
    ids.some(id=>!prior.includes(id)) || ids.every((id,index)=>id===prior[index]))return quote;
  const selected=new Map(original.map(line=>[line.id,line]));
  let slot=0;
  return {...quote,lines:quote.lines.map(line=>isGeneral(line)
    ?selected.get(ids[slot++])!:line)};
}

/** A verified worktable permutation. All changes commit together after Done. */
export interface QuoteTableOrder {
 areas:string[];
 pieces:Record<string,string[]>;
 sinks:Record<string,string[]>;
 charges:Record<string,string[]>;
}
const isGeneralLine=(quote:Quote,line:QuoteLine)=>!line.sectionId||
 !quote.sections.some(s=>s.id===line.sectionId)||
 quote.sections.some(s=>s.id===line.sectionId&&isGeneralTakeoffSection(s));
const isMovable=(line:QuoteLine)=>!line.takeoffSinkId&&line.quantitySource?.syncMode!=='live';
const permutation=(before:string[],after:string[])=>
 before.length===after.length&&new Set(after).size===after.length&&after.every(id=>before.includes(id));

export function createQuoteTableOrder(quote:Quote):QuoteTableOrder {
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 const pieces:Record<string,string[]>={},sinks:Record<string,string[]>={},charges:Record<string,string[]>={};
 for(const area of areas){
  pieces[area.id]=(area.scope?.takeoffPieces??[]).map(p=>p.id);
  sinks[area.id]=(area.scope?.takeoffSinks??[]).map(s=>s.id);
  charges[area.id]=quote.lines.filter(l=>l.sectionId===area.id&&isMovable(l)).map(l=>l.id);
 }
 charges.__general=quote.lines.filter(l=>isGeneralLine(quote,l)&&isMovable(l)).map(l=>l.id);
 return {areas:areas.map(a=>a.id),pieces,sinks,charges};
}
/** Reject stale rows and changed identities rather than reorder the wrong quote. */
export function setQuoteTableOrder(quote:Quote,next:QuoteTableOrder):Quote {
 const initial=createQuoteTableOrder(quote);
 if(!permutation(initial.areas,next.areas))return quote;
 for(const kind of ['pieces','sinks','charges'] as const)
  for(const [id,ids] of Object.entries(initial[kind]))
   if(!next[kind][id]||!permutation(ids,next[kind][id]))return quote;
 const orderedIds=[...next.areas,...quote.sections.filter(isGeneralTakeoffSection).map(s=>s.id)];
 const bySection=new Map(quote.sections.map(s=>[s.id,s]));
 const sections=orderedIds.map(id=>{
  const s=bySection.get(id)!;
  if(!next.pieces[id]||!next.sinks[id])return s;
  const byPiece=new Map((s.scope?.takeoffPieces??[]).map(p=>[p.id,p]));
  const bySink=new Map((s.scope?.takeoffSinks??[]).map(item=>[item.id,item]));
  return {...s,scope:{...s.scope,
   takeoffPieces:next.pieces[id].map(key=>byPiece.get(key)!),
   takeoffSinks:next.sinks[id].map(key=>bySink.get(key)!)}};
 });
 let lines=[...quote.lines];
 for(const [id,ids] of Object.entries(next.charges)){
  const inGroup=(l:QuoteLine)=>isMovable(l)&&(id==='__general'?isGeneralLine(quote,l):l.sectionId===id);
  const byId=new Map(lines.filter(inGroup).map(l=>[l.id,l]));
  let i=0;lines=lines.map(l=>inGroup(l)?byId.get(ids[i++])!:l);
 }
 const unchanged=quote.sections.every((s,i)=>sections[i]?.id===s.id&&
  (s.scope?.takeoffPieces??[]).every((p,j)=>sections[i].scope?.takeoffPieces?.[j]?.id===p.id)&&
  (s.scope?.takeoffSinks??[]).every((k,j)=>sections[i].scope?.takeoffSinks?.[j]?.id===k.id))
  &&quote.lines.every((l,i)=>l===lines[i]);
 return unchanged?quote:{...quote,sections,lines};
}
