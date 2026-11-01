import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('GitHub Actions manual release checks', () => {
  it('does not run routine GitHub-hosted builds on push or PR', () => {
    const names = [
      'react-foundation.yml',
      'visual-qc.yml',
      'pricing-schedule-qc.yml',
      'navigation-smoke.yml',
      'private-quote-rls-qc.yml',
      'private-deal-roles-qc.yml',
      'supabase-staging-privacy-matrix.yml',
    ];
    for (const name of names) {
      const source = readFileSync(join(process.cwd(), '.github/workflows', name), 'utf8');
      const triggers = source.split(/\non:\s*\n/)[1]?.split(/\n(?:permissions|concurrency|jobs):/)[0] ?? '';
      expect(triggers, name).toContain('workflow_dispatch:');
      expect(triggers, name).not.toMatch(/^\s*(push|pull_request):/m);
    }
  });

  it('keeps the legacy main-only GitHub Pages publisher as an explicit manual fallback', () => {
    const source = readFileSync(join(process.cwd(), '.github/workflows/react-foundation.yml'), 'utf8');
    const mainOnly = "if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'";
    expect(source.split(mainOnly).length - 1).toBe(4);
    expect(source).toContain("printf 'app.salesshop.work\\n' > dist/CNAME");
    expect(source).toContain('uses: actions/deploy-pages@v4');
    expect(source).toContain('run: npm test');
    expect(source).toContain('run: npm run build');
  });
});
