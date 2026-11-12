import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {Connections} from '../components/Connections';
import {readFileSync} from 'node:fs';

const crm=readFileSync(new URL('../components/Connections.tsx',import.meta.url),'utf8');
const tasks=readFileSync(new URL('../components/TasksWorkspace.tsx',import.meta.url),'utf8');

describe('Workspace data hydration feedback',()=>{
  it('announces Records load instead of showing empty records before hydration',()=>{
    const html=renderToStaticMarkup(<Connections/>);
    expect(html).toContain('Loading Records');
    expect(html).toContain('Opening companies, people, deals');
    expect(html).toContain('role="status"');
    expect(crm).toContain("style={!recordsReady?{display:'none'}:undefined}");
    expect(crm).toContain("const recordsReady=crmReady&&quotesReady;");
  });
  it("keeps the Tasks table scoped to the loaded user's records",()=>{
    expect(tasks).toContain('scope&&storedScope!==scope&&<WorkspaceLoadingState');
    expect(tasks).toContain('scope&&storedScope===scope&&<div className="tasks-table-container">');
    expect(tasks).toContain("title=\"Loading Tasks\"");
    expect(tasks).toContain("if(rolePreview)return");
  });
  it('preserves the existing headers and controls after stores hydrate',()=>{
    expect(crm).toContain('<WorkspaceHeader title="Records"');
    expect(crm).toContain('rows={companyTableRows}');
    expect(tasks).toContain('<WorkspaceHeader title="Tasks"');
    expect(tasks).toContain('rows={taskTableRows}');
  });
});
