import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceLoadingState } from './WorkspaceLoadingState';

describe('shared workspace loading feedback', () => {
  it('uses an announced loading status without a fake progress percentage', () => {
    const html = renderToStaticMarkup(
      <WorkspaceLoadingState title="Opening Materials" detail="Loading slab variants…" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Opening Materials');
    expect(html).toContain('Loading slab variants');
    expect(html).not.toContain('%');
  });
});
