import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Connections, CONNECTIONS_TABS } from './Connections';

describe('Connections workspace', () => {
  it('provides distinct locations for the business records and keeps Dashboard as Overview', () => {
    expect(CONNECTIONS_TABS.map((tab) => tab.id)).toEqual([
      'overview', 'companies', 'people', 'projects', 'quotes', 'activity',
    ]);
    expect(new Set(CONNECTIONS_TABS.map((tab) => tab.id)).size).toBe(CONNECTIONS_TABS.length);
  });

  it('renders a navigable Overview and an honest, disabled personal scope until ownership is implemented', () => {
    const html = renderToStaticMarkup(<Connections />);
    expect(html).toContain('Connections');
    expect(html).toContain('Sales dashboard');
    expect(html).toContain('Companies');
    expect(html).toContain('People');
    expect(html).toContain('Mine · Soon');
    expect(html).toContain('disabled');
  });
});
