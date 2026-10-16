import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';

describe('Connections record layout parity', () => {
  for (const [entityType, collection, display] of [
    ['company', 'Companies', 'company'],
    ['person', 'People', 'person'],
    ['project', 'Deals', 'Deal'],
  ] as const) {
    it('renders a single Back action and all three accessible mobile jump destinations for ' + display, () => {
      const html = renderToStaticMarkup(
        <RecordPageLayout entityType={entityType} title="Sample record" onBack={() => {}}
          left={<RecordCard title="About"><RecordProperty label="Name">Sample record</RecordProperty></RecordCard>}
          center={<RecordCard title="Work"><p>Linked records</p></RecordCard>}
          right={<RecordCard title="Related"><p>Relations</p></RecordCard>} />
      );
      expect(html).toContain('aria-label="' + display + ' record"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('>' + collection + '</span>');
      expect(html).toContain('aria-label="Jump to record section"');
      expect(html).toContain('>Details</button>');
      expect(html).toContain('>Records</button>');
      expect(html).toContain('>Related</button>');
      expect(html).toContain('aria-label="Record details"');
      expect(html).toContain('aria-label="Linked records"');
      expect(html).toContain('aria-label="Related records"');
      expect((html.match(/← Connections/g) ?? [])).toHaveLength(1);
      expect(html).not.toContain('Sales dashboard');
    });
  }

  it('accepts explicit Deal breadcrumb labels without changing stored entity types', () => {
    const html = renderToStaticMarkup(<RecordPageLayout
      entityType="project" recordTypeLabel="Deal" collectionLabel="Deals" title="School Renovation"
      onBack={() => {}} left={null} center={null} right={null}/>);
    expect(html).toContain('data-record-type="project"');
    expect(html).toContain('aria-label="Deal record"');
    expect(html).toContain('School Renovation');
  });
});
