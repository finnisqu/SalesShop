import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
describe('18A GitHub Pages deployment guard',()=>{
  it('does not deploy from architecture branch pushes or PRs',()=>{
    const workflow=readFileSync(join(process.cwd(),'.github/workflows/react-foundation.yml'),'utf8');
    expect(workflow).toContain('architecture/react-foundation');
    expect(workflow).toContain('  workflow_dispatch:');
    expect(workflow).toContain('run: npm test');
    expect(workflow).toContain('run: npm run build');
    expect(workflow.match(/if: github.event_name == 'workflow_dispatch'/g)?.length).toBe(4);
    expect(workflow).not.toContain("if: github.event_name != 'pull_request'");
    const deploy=workflow.slice(workflow.indexOf('\n  deploy:'));
    expect(deploy).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(deploy).toContain('uses: actions/deploy-pages@v4');
  });
});
