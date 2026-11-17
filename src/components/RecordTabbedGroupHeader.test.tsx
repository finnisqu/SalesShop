import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {RecordTabbedGroup372} from './RecordTabbedGroup372';

describe('record panel header actions',()=>{
 it('renders a compact About tab with no redundant bulk Edit button',()=>{
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Sample Deal"
   initialTab="about" items={[
    {id:'about',label:'About',content:<p>Editable property rows</p>},
    {id:'files',label:'Files',content:<p>Attachments</p>},
    {id:'notebook',label:'Notebook',content:<p>Pages</p>},
   ]}/>);
  const header=html.slice(html.indexOf('<header'),html.indexOf('</header>')+9);
  expect(header).toContain('role="tablist"');
  expect(header).toContain('aria-label="Sample Deal sections"');
  expect(header).toContain('>About</button>');
  expect(header).not.toContain('ss-record-tab-tools');
  expect(header).not.toContain('<h2>');
  expect(html).toContain('role="tabpanel"');
  expect(html).toContain('Editable property rows');
  expect(html).toContain('ss-record-tab-toolbar');
  expect(html).toContain('>About</strong>');
 });
 it('places the selected center-tab Manage action in the same header row',()=>{
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Connections" showTitle
   items={[
    {id:'people',label:'People',tools:<button type="button">Manage</button>,
     content:<p>Linked People</p>},
    {id:'tasks',label:'Tasks',content:<p>Tasks list</p>},
   ]}/>);
  const header=html.slice(html.indexOf('<header'),html.indexOf('</header>')+9);
  expect(header).toContain('>People</button>');
  expect(header).toContain('Manage</button>');
  expect(header).toContain('<h2 class="ss-record-panel-title">Connections</h2>');
  expect(html.slice(html.indexOf('</header>'))).not.toContain('Manage links');
 });
 it('renders a tab-specific toolbar with a count and a contextual action',()=>{
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Connections"
   items={[{id:'people',label:'People',toolbar:{label:'Linked people',meta:'3 linked',
    actions:<button type="button">+ Person</button>},content:<p>Rows</p>}]}/>);
  expect(html).toContain('ss-record-tab-toolbar');
  expect(html).toContain('Linked people');
  expect(html).toContain('3 linked');
  expect(html).toContain('+ Person');
 });
 it('lets internally managed panels own the same toolbar without duplication',()=>{
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Resources"
   items={[{id:'files',label:'Files',internalToolbar:true,content:<p>File panel</p>}]}/>);
  expect(html).not.toContain('ss-record-tab-toolbar');
 });
 it('all record About panels use inline editors without the Edit button',()=>{
  for(const page of ['Company','Deal','Person']){
   const text=readFileSync(new URL('./'+page+'RecordPage.tsx',import.meta.url),'utf8');
   const about=text.slice(text.indexOf("{id:'about',label:'About'"),text.indexOf('<RecordCard title="About this'));
   expect(about).toContain("{id:'about',label:'About',toolbar:{label:'Details'},content:<>");
   expect(about).not.toContain('tools:');
   expect(text).toContain('<RecordInlineProperty');
  }
 });
});
