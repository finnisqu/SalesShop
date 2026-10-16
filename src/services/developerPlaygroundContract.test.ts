import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedPlaygroundCrm, seedPlaygroundQuotes } from './playgroundFixtures';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Developer Playground isolation',()=>{
  const client=read('src/lib/supabase.ts');
  const gate=read('src/components/DeveloperPlaygroundGate.tsx');
  const route=read('src/main.tsx');
  const store=read('src/data/cloudAwareStorage.ts');
  const scope=read('src/lib/developerPlayground.ts');

  it('does not instantiate the ordinary tenant Supabase client in Playground',()=>{
    expect(client).toContain('developerPlaygroundActive ?');
    expect(client).toContain('export const supabaseUrl = localVisualQc || developerPlaygroundActive');
    expect(client).toContain('export const supabaseKey = localVisualQc || developerPlaygroundActive');
    expect(gate).toContain('playgroundIdentityClient.rpc');
    expect(gate).toContain("'is_platform_developer'");
    expect(gate).toContain("error || isDeveloper !== true");
    expect(gate).toContain('if (status === \'unauthorized\')');
    expect(route).toContain('<DeveloperPlaygroundGate><App /></DeveloperPlaygroundGate>');
  });

  it('namespaces every core local document, not normal cloud-user storage',()=>{
    expect(scope).toContain("salesshop-playground-v1:");
    expect(scope).toContain("url.search = '?studio=playground'");
    expect(scope).toContain("url.searchParams.delete('studio')");
    expect(scope).toContain("if (!isDeveloperPlaygroundRoute()) return;");
    expect(store).toContain('scopedStorageKey(LOCAL_STORAGE_KEYS[key])');
    for(const path of [
      'src/store/companySettingsStore.ts','src/store/navigationStore.ts',
      'src/store/rateBookStore.ts','src/store/sinkCatalogStore.ts',
      'src/store/materialLevelGuideStore.ts','src/store/supplierImportStore.ts',
      'src/store/appearanceStore.ts','src/store/rolePerspectiveStore.ts',
    ]) expect(read(path)).toContain('scopedStorageKey(');
  });

  it('seeds only clearly fictional organization, customer, contact and proposal data',()=>{
    const crm=seedPlaygroundCrm();
    const quotes=seedPlaygroundQuotes();
    expect(crm.companies.length).toBeGreaterThanOrEqual(4);
    expect(crm.contacts.length).toBeGreaterThanOrEqual(3);
    expect(crm.projects.length).toBeGreaterThanOrEqual(5);
    expect(quotes.quotes.length).toBeGreaterThanOrEqual(3);
    expect(crm.companies.every(c=>c.name.includes('Demo')||c.name.includes('Sample')||c.name.includes('Fictional'))).toBe(true);
    expect(crm.contacts.every(c=>c.email?.endsWith('.example'))).toBe(true);
    expect(quotes.quotes.every(q=>q.quoteNumber.startsWith('DEMO-'))).toBe(true);
    expect(quotes.quotes.every(q=>q.customerNotes.includes('Fictional'))).toBe(true);
  });

  it('only shows Developer controls in the actual Playground route',()=>{
    expect(read('src/App.tsx')).toContain('isDeveloperPlaygroundRoute() && <DeveloperPlaygroundToolbar />');
    const toolbar=read('src/components/DeveloperPlaygroundToolbar.tsx');
    expect(toolbar).toContain('resetPlaygroundStorage()');
    expect(toolbar).toContain('leavePlaygroundUrl()');
  });
});
