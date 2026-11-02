import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {QuoteBetaPricingOverview} from './QuoteBetaPricingOverview';
import type {Quote} from '../types/quote';

const area=(measured:boolean):Quote=>({
  id:'q',title:'Example',documentType:'quote',status:'Draft',
  sections:[{id:'kitchen',title:'Kitchen',
    scope:{takeoffPieces:measured?[{id:'top',name:'Top',count:1,lengthIn:72,widthIn:24}]:[]}}],
  lines:[],
} as unknown as Quote);
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
 it('guides the salesperson to the first priced-work blocker before private costs',()=>{
   const html=markup(area(true));
   expect(html).toContain('Resolve next pricing issue');
   expect(html).toContain('No priced work yet');
 });
 it('routes completed selling prices to the next private cost estimate',()=>{
   const q=area(true);
   q.lines=[{id:'top-price',sectionId:'kitchen',kind:'item',
     description:'Tops',pricingMode:'direct',amount:550,
     includeInTotal:true,customerVisible:true}];
   const html=markup(q);
   expect(html).toContain('Check next internal estimate');
   expect(html).toContain('Internal estimates');
   expect(html).toContain('0/1');
   expect(html).toContain('Missing: Material buying cost');
   expect(html).toContain('Open Calculator');
 });
 it('does not imply mandatory slab-cost coverage on empty or flat-fee Areas',()=>{
   const html=markup(area(false));
   expect(html).not.toContain('categories entered');
   expect(html).not.toContain('Margin incomplete');
 });
});
