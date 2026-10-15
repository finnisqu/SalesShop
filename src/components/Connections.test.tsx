import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Connections, CONNECTIONS_TABS, resolveConnectionsLandingTab } from './Connections';

describe('Privacy-first Connections navigation', () => {
  it('makes Companies, People and Projects the only prominent sections', () => {
    expect(CONNECTIONS_TABS.map((tab) => tab.id)).toEqual(['companies', 'people', 'projects']);
    expect(new Set(CONNECTIONS_TABS.map((tab) => tab.id)).size).toBe(CONNECTIONS_TABS.length);
  });

  it('migrates old dashboard/activity session selections to Companies', () => {
    expect(resolveConnectionsLandingTab('overview')).toBe('companies');
    expect(resolveConnectionsLandingTab('activity')).toBe('companies');
    expect(resolveConnectionsLandingTab('unknown')).toBe('companies');
    expect(resolveConnectionsLandingTab(null)).toBe('companies');
    expect(resolveConnectionsLandingTab('people')).toBe('people');
    expect(resolveConnectionsLandingTab('projects')).toBe('projects');
  });

  it('does not render the cross-company Sales Dashboard or activity as a top tab', () => {
    const html = renderToStaticMarkup(<Connections />);
    expect(html).toContain('Connections');
    expect(html).toContain('Companies');
    expect(html).toContain('People');
    expect(html).toContain('Projects');
    expect(html).toContain('More');
    expect(html).toContain('select a person to open their full record');
    expect(html).not.toContain('Sales dashboard');
    expect(html).not.toContain('Reporting view');
    expect(html).not.toContain('leadership-dashboard');
    expect(html).not.toContain('connections-overview');
    expect(html).not.toContain('Activity history');
    expect(html).not.toContain('connections-workspace-summary');
  });
});
