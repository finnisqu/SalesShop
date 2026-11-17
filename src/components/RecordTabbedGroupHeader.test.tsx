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
 it('all record About panels use inline editors without the Edit button',()=>{
  for(const page of ['Company','Deal','Person']){
   const text=readFileSync(new URL('./'+page+'RecordPage.tsx',import.meta.url),'utf8');
   const about=text.slice(text.indexOf("{id:'about',label:'About'"),text.indexOf('<RecordCard title="About this'));
   expect(about).toContain("{id:'about',label:'About',content:<>");
   expect(about).not.toContain('tools:');
   expect(text).toContain('<RecordInlineProperty');
  }
 });
});
