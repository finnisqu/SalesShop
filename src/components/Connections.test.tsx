import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Connections, CONNECTIONS_TABS, resolveConnectionsLandingTab } from './Connections';

describe('Privacy-first Records navigation', () => {
  it('uses five everyday Records tabs in requested order', () => {
    expect(CONNECTIONS_TABS.map((tab) => tab.id)).toEqual(['companies', 'people', 'deals', 'quotes', 'tasks']);
    expect(new Set(CONNECTIONS_TABS.map((tab) => tab.id)).size).toBe(CONNECTIONS_TABS.length);
  });

  it('resolves existing views while defaulting new Records sessions to Companies', () => {
    expect(resolveConnectionsLandingTab('overview')).toBe('companies');
    expect(resolveConnectionsLandingTab('activity')).toBe('activity');
    expect(resolveConnectionsLandingTab('unknown')).toBe('companies');
    expect(resolveConnectionsLandingTab(null)).toBe('companies');
    expect(resolveConnectionsLandingTab('people')).toBe('people');
    expect(resolveConnectionsLandingTab('deals')).toBe('deals');
    expect(resolveConnectionsLandingTab('projects')).toBe('companies');
  });

  it('renders the Records chrome without bringing back the old dashboard', () => {
    const html = renderToStaticMarkup(<Connections />);
    expect(html).toContain('Records');
    expect(html).toContain('Companies');
    expect(html).toContain('People');
    expect(html).toContain('Deals');
    expect(html).toContain('More');
    expect(html).not.toContain('Sales dashboard');
    expect(html).not.toContain('Reporting view');
    expect(html).not.toContain('leadership-dashboard');
    expect(html).not.toContain('connections-overview');
    expect(html).toContain('Activity');
    expect(html).not.toContain('connections-workspace-summary');
  });
});
