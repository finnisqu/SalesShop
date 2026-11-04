import { useEffect, useRef } from 'react';
import { MaterialsWorkspace } from './MaterialsWorkspace';
import { RatesWorkspace } from './RatesWorkspace';
import { SinksWorkspace } from './SinksWorkspace';
import { SuppliersWorkspace } from './SuppliersWorkspace';
import { CatalogTagsWorkspace } from './CatalogTagsWorkspace';
import { useNavigationStore, type CatalogSection } from '../store/navigationStore';
import { PageHeader, SectionTabs, Panel } from '../design-system/components';

export const CATALOG_SECTIONS: Array<{
  id: CatalogSection;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: 'materials',
    label: 'Materials',
    eyebrow: 'Surfaces & slab costs',
    description: 'Stone, quartz, porcelain, solid surface, and the supplier cost programs behind them.',
  },
  {
    id: 'sinks',
    label: 'Sinks',
    eyebrow: 'Models & variants',
    description: 'Physical sink products, configurations, customer pricing, and private cost.',
  },
  {
    id: 'other',
    label: 'Other',
    eyebrow: 'Accessories & shop inputs',
    description: 'Sellable accessories and the consumables or components that affect production cost and margin.',
  },
  {
    id: 'rates',
    label: 'Rates',
    eyebrow: 'Labor, services & pricing rules',
    description: 'Fabrication, installation, sink services, add-ons, and standard material pricing policy.',
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    eyebrow: 'Sources & price lists',
    description: 'The vendors behind materials, sinks, accessories, consumables, and future catalog purchasing.',
  },
  {
    id: 'tags',
    label: 'Tags',
    eyebrow: 'Material classifications',
    description: 'Browse and define the tags used across materials and slab variants.',
  },
];

function OtherCatalogComingSoon() {
  const examples = [
    'Brackets & corbels',
    'Dishwasher brackets',
    'Stone samples',
    'Clips & fasteners',
    'Protective film',
    'Adhesives & consumables',
  ];

  return (
    <section className="catalog-other-coming-soon">
      <Panel className="catalog-other-card catalog-foundation-other-card"
        heading={<><h2>Other</h2><span className="catalog-other-state">Planned</span></>}>
        <p>
          Accessories, shop supplies, and related purchasing items will live here.
        </p>
        <div className="catalog-other-example-grid">
          {examples.map((item) => <span key={item}>{item}</span>)}
        </div>
        <small>Examples of future catalog categories.</small>
      </Panel>
    </section>
  );
}

export function CatalogWorkspace() {
  const section = useNavigationStore((state) => state.catalogSection);
  const setSection = useNavigationStore((state) => state.setCatalogSection);
  const sectionScrollRef = useRef<HTMLElement>(null);

  // New sections start at the top instead of inheriting the previous section's
  // scroll position from the single shared mobile/desktop Catalog host.
  useEffect(() => {
    if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0;
  }, [section]);

  return (
    <main className="catalog-workspace">
      <PageHeader className="catalog-header catalog-foundation-heading"
        eyebrow="Commercial source of truth"
        title="Catalog"
        description="Materials, sinks, rates and suppliers for your quotes."
      />

      <SectionTabs className="catalog-section-nav catalog-foundation-tabs"
        aria-label="Catalog sections"
        items={CATALOG_SECTIONS.map(({ id, label }) => ({ id, label }))}
        selected={section} onSelect={setSection} />

      <section ref={sectionScrollRef} className={`catalog-section-host catalog-section-${section}`}>
        {section === 'materials' ? (
          <MaterialsWorkspace embedded />
        ) : section === 'sinks' ? (
          <SinksWorkspace embedded />
        ) : section === 'other' ? (
          <OtherCatalogComingSoon />
        ) : section === 'rates' ? (
          <RatesWorkspace embedded />
        ) : section === 'tags' ? (
          <CatalogTagsWorkspace />
        ) : (
          <SuppliersWorkspace />
        )}
      </section>
    </main>
  );
}
