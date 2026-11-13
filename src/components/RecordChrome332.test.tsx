import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {RecordInlineProperty} from './RecordInlineProperty';

const source=(name:string)=>readFileSync(new URL('./'+name,import.meta.url),'utf8');

describe('Batch 332e — unified Record inline property editing',()=>{
 it('renders a consistent accessible edit trigger only when permission allows it',()=>{
  const editable=renderToStaticMarkup(<RecordInlineProperty label="Deal name"
   value="Stone installation" onSave={()=>{}}/>);
  expect(editable).toContain('class="ss-record-inline-value"');
  expect(editable).toContain('aria-label="Edit Deal name"');
  expect(editable).toContain('Stone installation');
  const readOnly=renderToStaticMarkup(<RecordInlineProperty label="Deal name"
   value="Stone installation" disabled onSave={()=>{}}/>);
  expect(readOnly).not.toContain('aria-label="Edit Deal name"');
  const empty=renderToStaticMarkup(<RecordInlineProperty label="Phone"
   value="" placeholder="Not provided" onSave={()=>{}}/>);
  expect(empty).toContain('Not provided');
 });
 it('shares Escape and error-clearing behavior between input and select editors',()=>{
  const editor=source('RecordInlineProperty.tsx');
  expect(editor).toContain('onKeyDown={event=>{');
  expect(editor).toContain("event.key==='Escape'&&!event.defaultPrevented&&!saving");
  expect(editor).toContain('event.preventDefault();event.stopPropagation();close()');
  expect(editor).toContain("type==='select'?<select autoFocus");
  expect(editor).toContain("setDraft(event.target.value);setError('')");
  expect(editor).toContain('aria-busy={saving}');
 });
 it('returns keyboard focus to the same property without abandoning a pending save',()=>{
  const editor=source('RecordInlineProperty.tsx');
  expect(editor).toContain('const pencilRef=useRef<HTMLButtonElement>(null)');
  expect(editor).toContain('restoreFocus.current=false');
  expect(editor).toContain('pencilRef.current?.focus({preventScroll:true})');
  expect(editor).toContain('if(saving)return');
  expect(editor).toContain('try{await onSave(draft);restoreFocus.current=true;setEditing(false);}');
 });
 it('keeps mobile inline editor inputs, Save, Cancel and pencil touch-sized',()=>{
  const css=readFileSync(new URL('../record-page-refinement.css',import.meta.url),'utf8');
  expect(css).toContain('.ss-record-pencil{opacity:1;min-height:44px;flex-basis:44px}');
  expect(css).toContain('.ss-record-inline-editor button{flex-basis:44px;min-height:44px}');
  expect(css).not.toContain('.qwt-');
 });
});
