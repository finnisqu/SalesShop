import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {RecordInlineProperty} from './RecordInlineProperty';
import {RecordUnlinkButton} from './RecordUnlinkButton';

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
  expect(editor).toContain('try{await onSave(draft);restoreFocus.current=true;setEditing(false);release?.(id);}');
 });
 it('reuses the mobile viewport menu and returns focus after record actions',()=>{
  const menu=source('RecordActionsMenu.tsx');
  const helper=source('useViewportBoundDetails.ts');
  const css=readFileSync(new URL('../record-page-refinement.css',import.meta.url),'utf8');
  expect(menu).toContain('useViewportBoundDetails(ref)');
  expect(helper).toContain('.ss-record-actions-popover');
  expect(menu).toContain('closeMenu();onUnlink()');
  expect(menu).toContain('try{await onDelete();closeMenu();}');
  expect(menu).toContain("querySelector<HTMLElement>('summary')?.focus({preventScroll:true})");
  expect(css).toContain('.ss-record-actions-menu[data-worktable-side="above"]>.ss-record-actions-popover');
  expect(css).toContain('transform:translateX(var(--ss-worktable-menu-shift-x,0px))');
  expect(css).toContain('.ss-record-actions-popover button{min-height:44px}');
 });
 it('reuses one confirmed Unlink button across CRM, private Tasks and direct Deal contacts',()=>{
  const html=renderToStaticMarkup(<RecordUnlinkButton
   ariaLabel="Unlink Task Prepare submittal"
   confirmation="Confirm unlink?" onUnlink={()=>{}}/>);
  expect(html).toContain('class="ss-record-unlink-button"');
  expect(html).toContain('aria-label="Unlink Task Prepare submittal"');
  expect(html).toContain('>Unlink</button>');
  const disabled=renderToStaticMarkup(<RecordUnlinkButton
   ariaLabel="Unlink Deal" confirmation="Confirm unlink?" disabled onUnlink={()=>{}}/>);
  expect(disabled).toContain('disabled=""');
  const button=source('RecordUnlinkButton.tsx');
  expect(button).toContain('window.confirm(confirmation)');
  expect(button).toContain('try{await onUnlink();}');
  expect(button).toContain("reason instanceof Error?reason.message:'Could not unlink this record.'");
  for(const file of ['RecordUnlinkAction','RecordTasksPanel','DealPersonRelationships']){
   expect(source(file+'.tsx')).toContain('<RecordUnlinkButton');
  }
  expect(source('RecordUnlinkAction.tsx')).toContain("['Draft','Ready'].includes(quote.status)");
  expect(source('RecordTasksPanel.tsx')).toContain('!isProtectedBidTask(task)');
 });
 it('matches the Record More trigger to the header action height and touch-sized jump buttons',()=>{
  const chrome=readFileSync(new URL('../record-page-refinement.css',import.meta.url),'utf8');
  const record=readFileSync(new URL('../connections-record-pages.css',import.meta.url),'utf8');
  expect(chrome).toContain('min-width:42px;min-height:42px;cursor:pointer');
  expect(record).toContain('.connections-record-actions button{\n  min-height:42px;');
  expect(chrome).toContain('.ss-record-actions-menu>summary{min-height:44px;min-width:44px}');
  expect(record).toContain('border-radius:6px;min-height:44px;font-size:12px;');
  expect(chrome).toContain('background:var(--ss-theme-card);color:var(--ss-theme-ink)');
 });
 it('keeps linked-record navigation separate from compact Unlink buttons in every theme',()=>{
  const css=readFileSync(new URL('../record-page-refinement.css',import.meta.url),'utf8');
  const entity=readFileSync(new URL('../connections-record-pages.css',import.meta.url),'utf8');
  expect(entity).toContain('.connections-record-entity-list :is(article,button){');
  expect(css).toContain('grid-template-columns:minmax(0,1fr) auto');
  expect(css).toContain('.connections-record-entity-list :is(.ss-record-associated-row,article)');
  expect(css).toContain('.ss-record-unlink-control>.ss-record-unlink-button{');
  expect(css).toContain('width:auto;min-width:0;min-height:34px;');
  expect(css).toContain('color:var(--ss-theme-muted);background:var(--ss-theme-card)');
  expect(css).toContain('min-height:44px}}');
  for(const name of ['CompanyRecordPage','PersonRecordPage','DealRecordPage','RecordTasksPanel']){
   expect(source(name+'.tsx')).toContain('className="ss-record-associated-row"');
  }
 });
 it('keeps mobile inline editor inputs, Save, Cancel and pencil touch-sized',()=>{
  const css=readFileSync(new URL('../record-page-refinement.css',import.meta.url),'utf8');
  expect(css).toContain('.ss-record-pencil{opacity:1;min-height:44px;flex-basis:44px}');
  expect(css).toContain('.ss-record-inline-editor button{flex-basis:44px;min-height:44px}');
  expect(css).not.toContain('.qwt-');
 });
});
