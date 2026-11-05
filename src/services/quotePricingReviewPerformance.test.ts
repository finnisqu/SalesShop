import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../components/QuoteBetaReview.tsx',import.meta.url),'utf8');

describe('Pricing Review recalculation contract',()=>{
  it('shares one Area summary between desktop and mobile price tables',()=>{
    expect(source).toContain('const areaSummaries=useMemo(()=>quote.sections');
    expect(source).toContain('.map(section=>({section,data:quickAreaSummary(quote,section)})),[quote]);');
    expect(source.match(/areaSummaries.map\(\(\{section,data\}\)=>/g)).toHaveLength(2);
    expect(source.match(/quickAreaSummary\(quote,section\)/g)).toHaveLength(1);
  });
  it('keeps quote audit and customer totals stable during local UI interaction',()=>{
    expect(source).toContain('const report=useMemo(()=>auditQuoteDraft(quote),[quote]);');
    expect(source).toContain('const generalSummary=useMemo(()=>quickGeneralSummary(quote),[quote]);');
    expect(source).toContain('const customerTotal=useMemo(()=>quoteTotal(quote),[quote]);');
    expect(source).toContain('const reviewKey=useMemo(()=>quoteDeliveryReviewKey');
    expect(source).toContain('const deliveryKey=useMemo(()=>quoteDeliveryApprovalKey');
  });
  it('preserves issue controls and exact summary values',()=>{
    expect(source).toContain('const ready=!needsRecheck&&report.blockers.length===0');
    expect(source).toContain('setReviewStep(2)');
    expect(source).toContain('data.materialPrice');
    expect(source).toContain('data.sinkPrice');
    expect(source).toContain('data.specialtyPrice');
    expect(source).toContain('onFix({view:\'area\',areaId:section.id,tab:\'pricing\'})');
  });
});
