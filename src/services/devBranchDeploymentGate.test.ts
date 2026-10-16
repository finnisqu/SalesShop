import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

describe('GitHub Pages production deployment guard',()=>{
  it('tests development and main PRs but deploys only on main pushes or manual main dispatch',()=>{
    const workflow=readFileSync(join(process.cwd(),'.github/workflows/react-foundation.yml'),'utf8');
    expect(workflow).toContain('architecture/react-foundation');
    expect(workflow).toContain('      - main');
    expect(workflow).toContain('  workflow_dispatch:');
    expect(workflow).toContain('run: npm test');
    expect(workflow).toContain('run: npm run build');

    const publishGate="if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'";
    const occurrences=workflow.split(publishGate).length-1;
    // Configure Pages, SPA fallback, upload artifact, and deploy must share the same main-only guard.
    expect(occurrences).toBe(4);
    expect(workflow).not.toContain("if: github.event_name != 'pull_request'");
    expect(workflow).not.toContain("if: github.event_name == 'workflow_dispatch'\n");
    expect(workflow).toContain("printf 'app.salesshop.work\\n' > dist/CNAME");
    const deploy=workflow.slice(workflow.indexOf('\n  deploy:'));
    expect(deploy).toContain(publishGate);
    expect(deploy).toContain('uses: actions/deploy-pages@v4');
    expect(deploy).toContain('Smoke-test production HTML and asset delivery');
  });
});
