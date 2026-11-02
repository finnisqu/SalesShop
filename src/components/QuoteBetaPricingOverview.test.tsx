import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {QuoteBetaPricingOverview} from './QuoteBetaPricingOverview';
import type {Quote} from '../types/quote';

const area=(measured:boolean):Quote=>({
  id:'q',title:'Example',documentType:'quote',status:'Draft',
  sections:[{id:'kitchen',title:'Kitchen',
    scope:{takeoffPieces:measured?[{id:'top',name:'Top',count:1,lengthIn:72,widthIn:24}]:[]}}],
  lines:[],
} as Quote);
const noop=()=>{};
const markup=(quote:Quote)=>renderToStaticMarkup(<QuoteBetaPricingOverview quote={quote}
  onArea={noop} onGeneral={noop} onResolve={noop} onReview={noop}/>);

describe('Quote Beta pricing overview internal cost coverage',()=>{
 it('provides private cost estimate and calculator navigation for measured Areas',()=>{
   const html=markup(area(true));
   expect(html).toContain('Private cost estimate');
   expect(html).toContain('2/5 categories entered');
   expect(html).toContain('Margin incomplete');
   expect(html).toContain('Open Calculator');
 });
 it('does not imply mandatory slab-cost coverage on empty or flat-fee Areas',()=>{
   const html=markup(area(false));
   expect(html).not.toContain('categories entered');
   expect(html).not.toContain('Margin incomplete');
 });
});
