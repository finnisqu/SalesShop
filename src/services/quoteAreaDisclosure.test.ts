import {describe,expect,it} from 'vitest';
import type {Quote,QuoteSection} from '../types/quote';
import {quoteAreaDisclosure} from './quoteAreaDisclosure';
const section={id:'k',title:'Kitchen'} as QuoteSection;
const quote=(patch:Partial<Quote>={}):Quote=>({id:'draft',title:'Sample',status:'Draft',
  documentType:'quote',sections:[section],lines:[],...patch} as Quote);
describe('optional Area sections are read-only presentation choices',()=>{
  it('starts optional sinks and extras compact on an untouched Area',()=>{
    const q=quote(),original=JSON.stringify(q);
    expect(quoteAreaDisclosure(q,section)).toMatchObject({sinks:0,extras:0,sinksOpen:false,extrasOpen:false});
    expect(JSON.stringify(q)).toBe(original);
  });
  it('opens existing sink and add-on content so it is never hidden on arrival',()=>{
    const area={...section,scope:{takeoffSinks:[{id:'s',count:1,name:'Bowl'}]}} as QuoteSection;
    const q=quote({sections:[area],lines:[{id:'fee',sectionId:'k',kind:'item',description:'Edge work'} as Quote['lines'][number]]});
    expect(quoteAreaDisclosure(q,area)).toMatchObject({sinks:1,extras:1,sinksOpen:true,extrasOpen:true});
  });
  it('does not misclassify an Area primary countertop line as an add-on',()=>{
    const primary={id:'top',sectionId:'k',kind:'material',
      quantitySource:{syncMode:'live',field:'countertopSf'}} as Quote['lines'][number];
    const q=quote({lines:[primary]});
    expect(quoteAreaDisclosure(q,section)).toMatchObject({extras:0,extrasOpen:false});
  });
  it('does not treat a managed sink charge as a separate add-on',()=>{
    const q=quote({lines:[{id:'managed',sectionId:'k',takeoffSinkId:'s',kind:'sink'} as Quote['lines'][number]]});
    expect(quoteAreaDisclosure(q,section).extras).toBe(0);
  });
});
