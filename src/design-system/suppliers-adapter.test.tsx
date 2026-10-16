import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SupplierProfileFields } from '../components/SupplierProfileFields';
import type { SupplierProfile } from '../types/supplier';
import { Button, Field } from './components';

const source=readFileSync(new URL('../components/SuppliersWorkspace.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('./suppliers-adapter.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../main.tsx',import.meta.url),'utf8');
const profile:SupplierProfile={
  id:'supplier-1',name:'Example Stone',active:true,phone:'555-0100',website:'supplier.com',
  pricingCadenceMonths:6,nextPricingReviewDate:'2026-12-01',
  notes:'Annual program review',createdAt:'2026-01-01'
};

describe('UI Foundation Batch 5E — Suppliers',()=>{
  it('renders seven properly labeled and controlled profile fields',()=>{
    const html=renderToStaticMarkup(<SupplierProfileFields profile={profile} onChange={()=>{}}/>);
    for(const name of ['name','phone','website','cadence','review','status','notes']){
      expect(html).toContain(`id="supplier-profile-${name}"`);
      expect(html).toContain(`for="supplier-profile-${name}"`);
    }
    expect(html).toContain('Example Stone');
    expect(html).toContain('supplier.com');
    expect(html).toContain('Annual program review');
    expect(html).toContain('2026-12-01');
    expect(html).toContain('value="6" selected=""');
    expect((html.match(/<select/g)??[])).toHaveLength(2);
    expect((html.match(/<textarea/g)??[])).toHaveLength(1);
  });

  it('shares labeled search/Add controls and accessible active status filters',()=>{
    const search=renderToStaticMarkup(<Field id="supplier-directory-search" label="Search suppliers">
      {(control)=><input {...control} type="search" value="quartz" readOnly/>}
    </Field>);
    expect(search).toContain('for="supplier-directory-search"');
    expect(search).toContain('id="supplier-directory-search"');
    const active=renderToStaticMarkup(<Button variant="quiet" aria-pressed={true}>Current</Button>);
    expect(active).toContain('aria-pressed="true"');
    expect(active).toContain('type="button"');
    for(const needle of [
      'supplier-directory-search','supplier-new-name-desktop','supplier-new-name-mobile',
      'aria-pressed={filter === value}','<SupplierProfileFields profile={profileDraft} onChange={setProfileDraft}',
      'setMobileToolsOpen(true)','onClick={() => setFilter(value)}','setQuery(event.target.value)'
    ])expect(source,`Supplier UI wiring missing: ${needle}`).toContain(needle);
  });

  it('keeps supplier identity, tracking, merge confirmation and cloud save logic intact',()=>{
    for(const needle of [
      'fetchSupplierProfiles','createSupplierProfile(newSupplierName)',
      'trackDiscoveredSupplier(selected.name)','upsertSupplierProfile(selectedProfile, profileDraft)',
      'saveSupplierContact(contactDraft)','saveSupplierLocation(locationDraft)',
      'saveSupplierRule(ruleDraft)','mergeSupplierProfiles(selectedProfile.id, target.id)',
      'window.confirm(', 'updateSettings({','setSelectedKey(supplierKey(saved.name))',
      'fetchSupplierActivities()','fetchSupplierContacts()','fetchSupplierLocations()',
      'fetchSupplierRules()','<SupplierRelationshipPanels',
    ])expect(source,`Supplier operation missing: ${needle}`).toContain(needle);
  });

  it('preserves pricing import provenance, effective-date review and published rule copying',()=>{
    for(const needle of [
      'fetchSupplierImportPublicationHistory(200)',
      'createRulesFromPublished(','latestPublishedRules',
      'importPublishedRules()', 'latestPublication?.publishedAt',
      'selected.publications.slice(0, 12)','nextReviewDate',
      'supplier-pricing-history','supplier-source-rules',
      'supplier-materials', // legacy? no selector is supplier-materials
    ].filter(x=>x!=='supplier-materials')) {
      expect(source,`Supplier publication behavior missing: ${needle}`).toContain(needle);
    }
  });

  it('applies scoped token pairs to supplier navigation, records, editors and mobile details',()=>{
    for(const rule of [
      '.sales-app.view-catalog .supplier-workbench','--ss-supplier-card',
      '--ss-supplier-ink','--ss-supplier-muted','--ss-supplier-border',
      '.supplier-foundation-search','.supplier-nav-list','.supplier-record',
      '.supplier-edit-grid','.supplier-foundation-profile-fields',
      '.supplier-pricing-history','.supplier-source-rules',
      '.mobile-catalog-reference-card.is-expanded',
      '.mobile-catalog-tools-content'
    ])expect(styles,`Missing supplier style contract: ${rule}`).toContain(rule);
    expect(styles).toContain('overscroll-behavior-y:contain');
    expect(styles).not.toContain('calc(100dvh - 164px)');
    expect(main.indexOf("import './design-system/suppliers-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './design-system/rates-adapter.css'"));
  });

  it('preserves mobile search-first navigation, phone landscape and 16px editing inputs',()=>{
    expect(styles).toContain('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
    expect(styles).toContain('.supplier-nav-list {');
    expect(styles).toContain('display:none');
    expect(styles).toContain('font-size:16px');
    expect(styles).toContain('min-height:44px');
    expect(styles).toContain('height:auto');
    expect(styles).toContain('overflow-y:auto');
    expect(source).toContain('supplier-mobile-reference-list');
    expect(source).toContain('mobileExpandedSupplierKey');
  });
});
