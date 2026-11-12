import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {PersonalTask} from '../store/personalTaskStore';
import {TaskPreviewDueControls} from './TaskPreviewDueControls';

const base:PersonalTask={
 id:'task-example',title:'Contact the builder',
 type:'call',status:'open',priority:'normal',
 dueDate:'2026-11-13',createdAt:'2026-11-10T12:00:00Z',
 updatedAt:'2026-11-11T12:00:00Z',
};

describe('Task Quick View schedule parity',()=>{
 it('offers both short presets and a precise calendar date for ordinary tasks',()=>{
  const html=renderToStaticMarkup(<TaskPreviewDueControls task={base} onUpdate={()=>{}}/>);
  expect(html).toContain('Quick reschedule Contact the builder');
  expect(html).toContain('Today');
  expect(html).toContain('Tomorrow');
  expect(html).toContain('In 7 days');
  expect(html).toContain('Clear due date');
  expect(html).toContain('type="date"');
 });
 it('keeps generated submission deadlines tied to Deal instead of changing them independently',()=>{
  const html=renderToStaticMarkup(<TaskPreviewDueControls
   task={{...base,sourceObjectId:'deal-submit:deal-1'}} onUpdate={()=>{}}/>);
  expect(html).toContain('Bid deadline follows the linked Deal');
  expect(html).not.toContain('type="date"');
  expect(html).not.toContain('Quick date');
 });
 it('does not show rescheduling controls on completed or canceled tasks',()=>{
  for(const status of ['completed','canceled'] as const){
   expect(renderToStaticMarkup(<TaskPreviewDueControls task={{...base,status}} onUpdate={()=>{}}/>)).toBe('');
  }
 });
});
