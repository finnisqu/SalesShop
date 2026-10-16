import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import type {QuoteAuditFinding} from '../services/quoteDraftAudit';
import {quickFixForFinding} from './QuoteAuditInlineEditor';

const finding=(id:string):QuoteAuditFinding=>({
  id,severity:'review',title:'Zero-price charge',detail:'Confirm this amount.',
  destination:{view:'build'},
});
const quote=(mode:'direct'|'quantity-rate'|'slab-multiplier')=>({
  lines:[{id:'test',pricingMode:mode}],sections:[],
} as unknown as Quote);

describe('Quick Quote review quick fixes',()=>{
  it('edits the amount for a zero-price flat/direct charge',()=>{
    expect(quickFixForFinding(finding('line:test:zero'),quote('direct')))
      .toEqual({kind:'line',id:'test',field:'amount'});
  });
  it('edits the rate for a zero-price SF/quantity charge',()=>{
    expect(quickFixForFinding(finding('line:test:zero'),quote('quantity-rate')))
      .toEqual({kind:'line',id:'test',field:'rate'});
  });
  it('sends calculated slab prices to the full pricing workspace instead of writing an ignored rate',()=>{
    expect(quickFixForFinding(finding('line:test:zero'),quote('slab-multiplier')))
      .toBeUndefined();
  });
  it('keeps explicit missing-rate and missing-amount quick fixes unchanged',()=>{
    expect(quickFixForFinding(finding('line:test:rate'),quote('quantity-rate')))
      .toEqual({kind:'line',id:'test',field:'rate'});
    expect(quickFixForFinding(finding('line:test:amount'),quote('direct')))
      .toEqual({kind:'line',id:'test',field:'amount'});
  });
});
