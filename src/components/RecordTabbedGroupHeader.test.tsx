import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {RecordTabbedGroup372} from './RecordTabbedGroup372';

describe('record panel header actions',()=>{
 it('places Edit details beside the About tab, without a duplicate visible record name',()=>{
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Sample Deal"
   initialTab="about" items={[
    {id:'about',label:'About',tools:<button type="button">Edit details</button>,
     content:<p>Deal information</p>},
    {id:'files',label:'Files',content:<p>Attachments</p>},
    {id:'notebook',label:'Notebook',content:<p>Pages</p>},
   ]}/>);
  const header=html.slice(html.indexOf('<header'),html.indexOf('</header>')+9);
  expect(header).toContain('role="tablist"');
  expect(header).toContain('aria-label="Sample Deal sections"');
  expect(header).toContain('Edit details</button>');
  expect(header).toContain('>About</button>');
  expect(header).not.toContain('<h2>');
  expect(html.slice(html.indexOf('</header>'))).not.toContain('Edit details');
  expect(html).toContain('role="tabpanel"');
  expect(html).toContain('Deal information');
 });
 it('places the selected center-tab Manage links action in the same header row',()=>{
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Connections"
   items={[
    {id:'people',label:'People',tools:<button type="button">Manage links</button>,
     content:<p>Linked People</p>},
    {id:'tasks',label:'Tasks',content:<p>Tasks list</p>},
   ]}/>);
  const header=html.slice(html.indexOf('<header'),html.indexOf('</header>')+9);
  expect(header).toContain('>People</button>');
  expect(header).toContain('Manage links</button>');
  expect(header).not.toContain('<h2>Connections</h2>');
  expect(html.slice(html.indexOf('</header>'))).not.toContain('Manage links');
 });
 it('keeps contextual About edit actions in all record types',()=>{
  for(const page of ['Company','Deal','Person']){
   const text=readFileSync(new URL('./'+page+'RecordPage.tsx',import.meta.url),'utf8');
   const about=text.slice(text.indexOf("{id:'about',label:'About'"),text.indexOf('<RecordCard title="About this'));
   expect(about).toContain('tools:canEdit');
   expect(about).toContain('Edit details');
   expect(about).not.toContain('ss-record-local-actions');
  }
 });
});
