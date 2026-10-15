import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const file=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const screen=file('src/components/ShopOutcomesWorkspace.tsx');
const classic=file('src/components/Quotes.tsx');
const beta=file('src/components/QuotesMobileBeta.tsx');
const pilot=file('src/services/shopOutcomesPilot.ts');
const service=file('src/services/shopOutcomesService.ts');

describe('staged Shop Outcomes screen does not expose quote-library data',()=>{
  it('is disabled unless explicitly enabled by a deployment flag',()=>{
    expect(pilot).toContain("import.meta.env.VITE_SIGNED_SHOP_OUTCOMES === '1'");
    expect(classic).toContain('signedShopOutcomesEnabled');
    expect(beta).toContain('signedShopOutcomesEnabled');
    expect(classic).toContain('<ShopOutcomesWorkspace onShowMine=');
    expect(beta).toContain('<ShopOutcomesWorkspace onShowMine=');
  });
  it('accepts no quote, CRM or employee feed as props',()=>{
    expect(screen).toContain('loadSignedShopOutcomes()');
    expect(screen).not.toContain('useQuoteStore');
    expect(screen).not.toContain('useCrmStore');
    expect(screen).not.toContain('useSignatureStore');
    expect(screen).not.toContain('TeamQuotesWorkspace');
    expect(screen).not.toContain('quoteTotal(');
    expect(screen).not.toContain('internalCost');
    expect(screen).not.toContain('quote.lines');
    expect(screen).toContain('setOutcomes([])');
    expect(screen).toContain('let cancelled=false');
    expect(screen).toContain('loadedScope===currentScope');
    expect(screen).toContain("role==='owner'||role==='admin'");
    expect(service).toContain('sanitizeSignedShopOutcomes(data?.outcomes)');
  });
  it('does not offer a signed-only view to a logged-out user or non-manager',()=>{
    expect(screen).toContain("role!=='owner'&&role!=='admin'");
    expect(screen).toContain("if(!orgId||!userId||");
    expect(screen).toContain('setError(');
    expect(screen).toContain('Showing up to the most recent 100');
  });
});
