import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MobileWorkspaceTabs,WorkspaceHeader,WorkspaceMoreMenu} from './WorkspaceHeader';

describe('shared workspace chrome',()=>{
  it('renders contextual Help and keeps header tools in the same slots',()=>{
    const html=renderToStaticMarkup(<WorkspaceHeader title="Tasks"
      help={<span data-testid="help-content">Task help</span>}
      tabs={<button type="button">Open</button>}
      more={<WorkspaceMoreMenu items={[{label:'All history',onClick:()=>{}}]}/>}
      search={<input type="search" aria-label="Search tasks"/>}
      primary={<button type="button">+ Task</button>}/>);
    expect(html).toContain('ss-workspace-header__help');
    expect(html).toContain('Task help');
    expect(html).toContain('ss-workspace-header__tabs');
    expect(html).toContain('ss-workspace-header__tools');
    expect(html).toContain('ss-workspace-header__search');
    expect(html).toContain('ss-workspace-header__primary');
  });

  it('shows active menu choices and preserves their disabled state',()=>{
    const html=renderToStaticMarkup(<WorkspaceMoreMenu items={[
      {label:'Open',onClick:()=>{},active:true},
      {label:'Disabled',onClick:()=>{},disabled:true},
    ]}/>);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('ss-workspace-more__selected');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Open');
    expect(html).toContain('Disabled');
  });

  it('uses consistent More button copy while preserving a contextual accessible name',()=>{
    const html=renderToStaticMarkup(<WorkspaceMoreMenu label="Board More"
      items={[{label:'All pipelines',onClick:()=>{}}]}/>);
    expect(html).toContain('aria-label="Board More menu"');
    expect(html).toContain('<span>More</span>');
    expect(html).not.toContain('>Board More<');
  });

  it('renders the navigation More as a normal pill tab with a dropdown chevron',()=>{
    const html=renderToStaticMarkup(<WorkspaceMoreMenu label="Records sections" asTab
      items={[{section:'More records',label:'Pages',onClick:()=>{}}]}/>);
    expect(html).toContain('ss-workspace-more is-tab');
    expect(html).toContain('ss-chrome-icon-chevron-down');
    expect(html).not.toContain('ss-chrome-icon-more');
    expect(html).toContain('aria-label="Records sections menu"');
    expect(html).toContain('More records');
    expect(html).toContain('Pages');
  });

  it('marks the selected mobile section without creating duplicate active tabs',()=>{
    const html=renderToStaticMarkup(<MobileWorkspaceTabs title="Connections"
      items={[{value:'companies',label:'Companies'},{value:'people',label:'People'}]}
      value="people" onChange={()=>{}}/>);
    expect(html).toContain('Connections sections, selected People');
    expect(html).toContain('aria-current="page"');
    expect((html.match(/aria-current="page"/g)??[])).toHaveLength(1);
  });
});
