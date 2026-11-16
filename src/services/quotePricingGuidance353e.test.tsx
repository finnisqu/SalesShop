import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {QuoteBetaPricingOverview} from '../components/QuoteBetaPricingOverview';
import type {Quote} from '../types/quote';
import {pricingAreaMatches,pricingAreaMarginLabel,nextInternalCostTab} from './quotePricingGuidance353e';
describe('Batch 353e — Quote pricing triage without customer price changes',()=>{
 it('separates fully-loaded margin from partial known-cost spread',()=>{
  expect(pricingAreaMarginLabel({complete:false,marginPercent:undefined,knownCostSpreadPercent:38.3}))
   .toContain('Known-cost spread 38.3% (partial estimate');
  expect(pricingAreaMarginLabel({complete:false,marginPercent:undefined,knownCostSpreadPercent:38.3}))
   .not.toContain('fully-loaded');
  expect(pricingAreaMarginLabel({complete:true,marginPercent:12.5,knownCostSpreadPercent:12.5}))
   .toBe('Estimated fully-loaded margin 12.5%');
  expect(pricingAreaMarginLabel({complete:false})).toBe('Margin incomplete');
 });
 it('routes absent material/sink costs to Materials and labor to Calculator',()=>{
  const coverage={material:true,sinks:true,shop:false,install:false,other:true};
  expect(nextInternalCostTab({costCoverage:coverage})).toBe('calculator');
  expect(nextInternalCostTab({costCoverage:{...coverage,material:false}})).toBe('materials');
  expect(nextInternalCostTab({costCoverage:{...coverage,sinks:false}})).toBe('materials');
 });
 it('keeps selling and buying gaps separate, including flat fee Areas',()=>{
  const row={blockers:0,measuredSf:60,costComplete:false};
  expect(pricingAreaMatches('selling',row)).toBe(false);
  expect(pricingAreaMatches('cost',row)).toBe(true);
  expect(pricingAreaMatches('ready',row)).toBe(false);
  expect(pricingAreaMatches('selling',{...row,blockers:2})).toBe(true);
  expect(pricingAreaMatches('ready',{blockers:0,measuredSf:0,costComplete:false})).toBe(true);
  expect(pricingAreaMatches('all',row)).toBe(true);
 });
 it('renders practical, private filters and preserves direct review navigation',()=>{
  const quote={id:'q',title:'Kitchen',documentType:'quote',status:'Draft',
   sections:[{id:'k',title:'Kitchen',scope:{takeoffPieces:[{id:'p',name:'top',count:1,lengthIn:72,widthIn:24}]}}],
   lines:[]} as unknown as Quote;
  const none=()=>{};
  const html=renderToStaticMarkup(<QuoteBetaPricingOverview quote={quote}
   onArea={none} onGeneral={none} onResolve={none} onReview={none}/>);
  expect(html).toContain('Needs sell price');
  expect(html).toContain('Missing internal costs');
  expect(html).toContain('Ready for review');
  expect(html).toContain('Check material/sink costs');
  expect(html).toContain('Review quote');
  const source=readFileSync(new URL('../components/QuoteBetaPricingOverview.tsx',import.meta.url),'utf8');
  expect(source).toContain('filteredRows.map');
  expect(source).toContain('nextInternalCostTab(cost)');
 });
});
