import {afterEach,describe,expect,it,vi} from 'vitest';
import type {QuoteSection} from '../types/quote';
import {captureSavedAreaLayout,decodeSavedAreaLayouts,instantiateSavedAreaLayout,
 readSavedAreaLayouts,writeSavedAreaLayouts,savedAreaLayoutScope,upsertSavedAreaLayout,
 SAVED_AREA_LAYOUT_LIMIT} from './quoteSavedAreaLayouts';

const original=():QuoteSection=>({
 id:'customer-area',title:'Customer-specific Kitchen',
 customerVisible:true,customerDisplayMode:'summary',
 scope:{
  takeoffPieces:[{id:'customer-piece',name:'Main run',count:2,lengthIn:96,widthIn:25.5,
   backsplash:true,leftSplash:false,rightSplash:false,splashHeightIn:4,edgeProfile:'Pencil'}],
  takeoffMaterial:'Brand quartz $75/SF',
  takeoffSinks:[{id:'sink',category:'kitchen',name:'Chargeable sink',count:1,
    includeInPricing:true,unitPrice:225}],
  slabCostOverride:650,shopCostOverride:150,installCostRateSf:5,
  countertopSf:33,slabYield:.65,targetMargin:.3,
 },
});
afterEach(()=>vi.unstubAllGlobals());
describe('personal saved Area layout data boundary',()=>{
 it('captures geometry and defaults but never stores prices, sinks, customer info or catalog references',()=>{
  const captured=captureSavedAreaLayout(original(),'Reusable Kitchen','layout-one','2026-11-02')!;
  expect(captured.pieces[0]).toMatchObject({
   name:'Main run',count:2,lengthIn:96,widthIn:25.5,backsplash:true,edgeProfile:'Pencil',
  });
  const raw=JSON.stringify(captured);
  for(const privateValue of ['Customer-specific','Brand quartz','Chargeable sink',
     'slabCostOverride','targetMargin','225','650','customer-piece']){
    expect(raw).not.toContain(privateValue);
  }
  const remade=instantiateSavedAreaLayout(captured,'new-area',()=> 'new-piece');
  expect(remade.id).toBe('new-area');
  expect(remade.title).toBe('Reusable Kitchen');
  expect(remade.scope?.takeoffPieces?.[0].id).toBe('new-piece');
  expect(remade.scope?.takeoffPieces?.[0].lengthIn).toBe(96);
  expect(remade.scope?.takeoffSinks).toBeUndefined();
  expect(remade.scope?.takeoffMaterialReference).toBeUndefined();
  expect(remade.scope?.slabCostOverride).toBeUndefined();
  expect(remade.scope?.countertopSf).toBeUndefined();
  expect(original().scope?.takeoffPieces?.[0].id).toBe('customer-piece');
 });
 it('treats browser data as untrusted and strips extra fields',()=>{
  const preset=captureSavedAreaLayout(original(),'My kitchen','id','now')!;
  const poisoned={...preset,customerEmail:'private@example.com',
   pieces:[{...preset.pieces[0],internalCost:990,materialId:'catalog'}]};
  const [clean]=decodeSavedAreaLayouts([poisoned]);
  expect(clean).toEqual(preset);
  expect(JSON.stringify(clean)).not.toContain('private@example.com');
  expect(decodeSavedAreaLayouts([{...preset,pieces:[{name:'invalid',count:-1}]}])).toEqual([]);
  expect(decodeSavedAreaLayouts([{...preset,pieces:Array(61).fill(preset.pieces[0])}])).toEqual([]);
 });
 it('separates the two organization/user pairs on one browser',()=>{
  const a=savedAreaLayoutScope('cloud','org-one','user-a');
  const b=savedAreaLayoutScope('cloud','org-one','user-b');
  const c=savedAreaLayoutScope('cloud','org-two','user-a');
  expect(a).not.toBe(b);expect(a).not.toBe(c);expect(b).not.toBe(c);
  expect(savedAreaLayoutScope('cloud','org-one',null)).toBeNull();
  expect(savedAreaLayoutScope('local',null,null)).toBe('local-device');
  const entries=new Map<string,string>();
  vi.stubGlobal('localStorage',{
   getItem:(key:string)=>entries.get(key)??null,
   setItem:(key:string,value:string)=>{entries.set(key,value);},
  });
  const preset=captureSavedAreaLayout(original(),'Shared computer only','id','now')!;
  expect(writeSavedAreaLayouts(a,[preset])).toBe(true);
  expect(readSavedAreaLayouts(a)).toHaveLength(1);
  const unsafe={...preset,contactEmail:'should-not-persist@example.com'};
  expect(writeSavedAreaLayouts(a,[unsafe])).toBe(true);
  expect(entries.get('salesshop-quote-area-layouts-v1:'+a)).not.toContain('should-not-persist');
  expect(readSavedAreaLayouts(b)).toEqual([]);
  expect(readSavedAreaLayouts(c)).toEqual([]);
  expect(writeSavedAreaLayouts(null,[preset])).toBe(false);
 });
 it('fails safely when storage is unavailable, and limits saved templates',()=>{
  const layout=captureSavedAreaLayout(original(),'Layout','one','now')!;
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('Storage off');},
    setItem:()=>{throw Error('Storage off');}});
  expect(readSavedAreaLayouts('local-device')).toEqual([]);
  expect(writeSavedAreaLayouts('local-device',[layout])).toBe(false);
  const repeated=Array.from({length:SAVED_AREA_LAYOUT_LIMIT+1},(_,i)=>({...layout,id:String(i)}));
  expect(writeSavedAreaLayouts('local-device',repeated)).toBe(false);
  expect(upsertSavedAreaLayout([layout],{...layout,id:'two'})).toHaveLength(2);
  const zeroCount=original();
  zeroCount.scope!.takeoffPieces![0].count=0;
  expect(captureSavedAreaLayout(zeroCount,'Unfinished work','zero','now')?.pieces[0].count).toBe(0);
 });
});
