import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../components/Connections.tsx',import.meta.url),'utf8');

describe('Connections on-demand directory table calculations',()=>{
  it('builds only the currently displayed directory table',()=>{
    for(const [tab,rows] of [
      ['companies','companyRows'],['people','peopleRows'],
      ['deals','projectRows'],['quotes','quoteRows'],
    ]){
      expect(source).toContain("()=>tab==='"+tab+"'?"+rows+".map");
    }
  });
  it('computes quote totals only when the Quotes metadata tab is open',()=>{
    expect(source).toContain("()=>tab==='quotes'?quoteRows.map(q=>{");
    expect(source).toContain('const total=quoteTotal(q);');
    expect(source).not.toContain('const quoteTotals=useMemo');
    expect(source).toContain('value:money.format(total)');
    expect(source).toContain('sortValues:{value:total,updated:q.updatedAt}');
  });
  it('preserves each tab table and explicit company/deal counts',()=>{
    expect(source).toContain('rows={companyTableRows}');
    expect(source).toContain('rows={peopleTableRows}');
    expect(source).toContain('rows={dealTableRows}');
    expect(source).toContain('rows={quoteTableRows}');
    expect(source).toContain('counts.quotesByCompany.get(c.id)');
    expect(source).toContain('counts.quotesByDeal.get(project.id)');
  });
});
