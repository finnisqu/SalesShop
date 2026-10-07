import { MaterialsWorkspace } from './MaterialsWorkspace';
import { RatesWorkspace } from './RatesWorkspace';
import { SinksWorkspace } from './SinksWorkspace';
import { SuppliersWorkspace } from './SuppliersWorkspace';
import { useNavigationStore, type CatalogSection } from '../store/navigationStore';

const CATALOG_SECTIONS: Array<{
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
      <div className="catalog-other-card">
        <span className="board-eyebrow">Accessories & shop inputs</span>
        <h2>Other</h2>
        <p>
          This catalog will hold the physical items that do not belong under Materials or Sinks—whether we sell them directly
          to a customer or consume them while fabricating and installing countertops.
        </p>
        <div className="catalog-other-example-grid">
          {examples.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="catalog-coming-soon-badge">Coming soon!</div>
        <small>
          The goal is one place for product cost, sell price, supplier, inventory relevance, and margin impact without forcing
          every shop input to become a customer-facing quote item.
        </small>
      </div>
    </section>
  );
}

export function CatalogWorkspace() {
  const section = useNavigationStore((state) => state.catalogSection);
  const setSection = useNavigationStore((state) => state.setCatalogSection);
  const current = CATALOG_SECTIONS.find((candidate) => candidate.id === section) ?? CATALOG_SECTIONS[0];

  return (
    <main className="catalog-workspace">
      <header className="catalog-header">
        <div>
          <span className="board-eyebrow">Commercial source of truth</span>
          <h1>Catalog</h1>
          <p>Products, purchasing inputs, supplier sources, and pricing references that feed SalesShop quoting and margin.</p>
        </div>
        <div className="catalog-current-section">
          <span>{current.eyebrow}</span>
          <strong>{current.label}</strong>
          <small>{current.description}</small>
        </div>
      </header>

      <nav className="catalog-section-nav" aria-label="Catalog sections">
        {CATALOG_SECTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={section === item.id ? 'active' : ''}
            onClick={() => setSection(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.eyebrow}</span>
          </button>
        ))}
      </nav>

      <section className={`catalog-section-host catalog-section-${section}`}>
        {section === 'materials' ? (
          <MaterialsWorkspace embedded />
        ) : section === 'sinks' ? (
          <SinksWorkspace embedded />
        ) : section === 'other' ? (
          <OtherCatalogComingSoon />
        ) : section === 'rates' ? (
          <RatesWorkspace embedded />
        ) : (
          <SuppliersWorkspace />
        )}
      </section>
    </main>
  );
}
