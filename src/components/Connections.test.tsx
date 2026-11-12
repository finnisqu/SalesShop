import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Connections, CONNECTIONS_TABS, resolveConnectionsLandingTab } from './Connections';

describe('Privacy-first Records navigation', () => {
  it('puts Tasks first and Activities alongside CRM Records', () => {
    expect(CONNECTIONS_TABS.map((tab) => tab.id)).toEqual(['tasks', 'companies', 'people', 'deals', 'activity', 'suppliers']);
    expect(new Set(CONNECTIONS_TABS.map((tab) => tab.id)).size).toBe(CONNECTIONS_TABS.length);
  });

  it('resolves existing views while defaulting new Records sessions to Tasks', () => {
    expect(resolveConnectionsLandingTab('overview')).toBe('tasks');
    expect(resolveConnectionsLandingTab('activity')).toBe('activity');
    expect(resolveConnectionsLandingTab('unknown')).toBe('tasks');
    expect(resolveConnectionsLandingTab(null)).toBe('tasks');
    expect(resolveConnectionsLandingTab('people')).toBe('people');
    expect(resolveConnectionsLandingTab('deals')).toBe('deals');
    expect(resolveConnectionsLandingTab('projects')).toBe('tasks');
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
    expect(html).toContain('Activities');
    expect(html).not.toContain('connections-workspace-summary');
  });
});
