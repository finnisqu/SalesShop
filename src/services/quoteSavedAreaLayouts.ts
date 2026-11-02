import type {QuoteSection,QuoteTakeoffPiece} from '../types/quote';

export const SAVED_AREA_LAYOUT_LIMIT=30;
export const SAVED_AREA_PIECE_LIMIT=60;
const STORAGE_PREFIX='salesshop-quote-area-layouts-v1:';
export interface SavedAreaLayoutPiece {
 name:string; lengthIn?:number; widthIn?:number; count:number;
 backsplash:boolean;leftSplash:boolean;rightSplash:boolean;
 splashHeightIn:number;edgeProfile:string;
}
export interface SavedAreaLayout{
 id:string;name:string;updatedAt:string;
 defaultSplashHeightIn:number;defaultEdgeProfile:string;
 pieces:SavedAreaLayoutPiece[];
}
const validString=(v:unknown,max:number)=>typeof v==='string'&&v.length>0&&v.length<=max;
const validNumber=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const optionalDimension=(v:unknown)=>v===undefined||validNumber(v,0,10000);
function decodePiece(value:unknown):SavedAreaLayoutPiece|null{
 if(!value||typeof value!=='object')return null;
 const p=value as Record<string,unknown>;
 if(typeof p.name!=='string'||p.name.length>140||!optionalDimension(p.lengthIn)||!optionalDimension(p.widthIn)
   ||!Number.isInteger(p.count)||!validNumber(p.count,0,1000)
   ||!validNumber(p.splashHeightIn,0,120)||typeof p.edgeProfile!=='string'||p.edgeProfile.length>80
   ||typeof p.backsplash!=='boolean'||typeof p.leftSplash!=='boolean'||typeof p.rightSplash!=='boolean')return null;
 return {name:p.name,count:p.count as number,lengthIn:p.lengthIn as number|undefined,
   widthIn:p.widthIn as number|undefined,
   backsplash:p.backsplash,leftSplash:p.leftSplash,rightSplash:p.rightSplash,
   splashHeightIn:p.splashHeightIn as number,edgeProfile:p.edgeProfile};
}
export function decodeSavedAreaLayouts(value:unknown):SavedAreaLayout[]{
 if(!Array.isArray(value))return [];
 const results:SavedAreaLayout[]=[];
 for(const raw of value.slice(0,SAVED_AREA_LAYOUT_LIMIT)){
   if(!raw||typeof raw!=='object')continue;
   const item=raw as Record<string,unknown>;
   if(!validString(item.id,100)||!validString(item.name,100)||!validString(item.updatedAt,50)
     ||!validNumber(item.defaultSplashHeightIn,0,120)
     ||!validString(item.defaultEdgeProfile,80)
     ||!Array.isArray(item.pieces)||item.pieces.length>SAVED_AREA_PIECE_LIMIT
     ||results.some(v=>v.id===item.id))continue;
   const pieces=item.pieces.map(decodePiece);
   if(pieces.some(p=>p===null))continue;
   results.push({id:item.id as string,name:item.name as string,updatedAt:item.updatedAt as string,
     defaultSplashHeightIn:item.defaultSplashHeightIn as number,
     defaultEdgeProfile:item.defaultEdgeProfile as string,pieces:pieces as SavedAreaLayoutPiece[]});
 }
 return results;
}
/** Never persist raw quote sections or line objects; this is an allowlist only. */
export function captureSavedAreaLayout(section:QuoteSection,name:string,id:string,at:string):SavedAreaLayout|null{
 const normalized=name.trim().slice(0,100);
 const pieces=section.scope?.takeoffPieces??[];
 if(!normalized||!id||pieces.length>SAVED_AREA_PIECE_LIMIT)return null;
 const candidate={
   id,name:normalized,updatedAt:at,
   defaultSplashHeightIn:section.scope?.takeoffDefaultSplashHeightIn??4,
   defaultEdgeProfile:section.scope?.takeoffDefaultEdgeProfile??'Flat',
   pieces:pieces.map(p=>({
     name:p.name,count:p.count,lengthIn:p.lengthIn,widthIn:p.widthIn,
     backsplash:p.backsplash===true,leftSplash:p.leftSplash===true,rightSplash:p.rightSplash===true,
     splashHeightIn:p.splashHeightIn??4,edgeProfile:p.edgeProfile??'Flat',
   })),
 };
 return decodeSavedAreaLayouts([candidate])[0]??null;
}
export function instantiateSavedAreaLayout(layout:SavedAreaLayout,sectionId:string,
 nextPieceId:()=>string):QuoteSection{
 const valid=decodeSavedAreaLayouts([layout])[0];
 if(!valid)throw new Error('Saved Area layout is invalid.');
 const pieces:QuoteTakeoffPiece[]=valid.pieces.map(piece=>({...piece,id:nextPieceId()}));
 return {id:sectionId,title:valid.name,customerVisible:true,customerDisplayMode:'detail',
   scope:{takeoffPieces:pieces,
     takeoffDefaultSplashHeightIn:valid.defaultSplashHeightIn,
     takeoffDefaultEdgeProfile:valid.defaultEdgeProfile}};
}
/** A signed-in user can reuse their own on-device templates within one organization. */
export function savedAreaLayoutScope(mode:'local'|'cloud',orgId:string|null,userId:string|null):string|null{
 if(mode==='local')return 'local-device';
 return orgId&&userId?encodeURIComponent(orgId)+':'+encodeURIComponent(userId):null;
}
const storageKey=(scope:string)=>STORAGE_PREFIX+scope;
export function readSavedAreaLayouts(scope:string|null):SavedAreaLayout[]{
 if(!scope)return [];
 try{return decodeSavedAreaLayouts(JSON.parse(localStorage.getItem(storageKey(scope))??'null'));}
 catch{return [];}
}
export function writeSavedAreaLayouts(scope:string|null,items:SavedAreaLayout[]):boolean{
 if(!scope||items.length>SAVED_AREA_LAYOUT_LIMIT)return false;
 const sanitized=decodeSavedAreaLayouts(items);
 if(sanitized.length!==items.length)return false;
 try{localStorage.setItem(storageKey(scope),JSON.stringify(sanitized));return true;}
 catch{return false;}
}
export function upsertSavedAreaLayout(items:readonly SavedAreaLayout[],item:SavedAreaLayout):SavedAreaLayout[]{
 const filtered=items.filter(p=>p.id!==item.id);
 return [item,...filtered].slice(0,SAVED_AREA_LAYOUT_LIMIT);
}
