import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('People follow-up workflows',()=>{
 it('filters the same People data used by mobile cards and desktop worktable',()=>{
  const connections=read('src/components/Connections.tsx');
  expect(connections).toContain('matchesPersonAttentionFilter(person.id,peopleAttention');
  expect(connections).toContain('Never contacted');
  expect(connections).toContain('Inactive 30+ days');
  expect(connections).toContain('Follow-up overdue');
  expect(connections).toContain('connections-person-follow-up');
  expect(connections).toContain('followUpByPerson.get(person.id)');
  expect(connections).toContain('personalTaskScope===expectedTaskScope');
 });
 it('offers a follow-up after a real native-app interaction without automatic logging',()=>{
  const preview=read('src/components/RecordPreviewDrawer.tsx');
  expect(preview).toContain('quickFollowUpEnabled');
  expect(preview).toContain('Create follow-up task');
  expect(preview).toContain('type="date" min={localCalendarDay(new Date())}');
  expect(preview).toContain('onClick={logConfirmedPersonInteraction}');
  expect(preview).toContain('personQuickFollowUp({');
  expect(preview).toContain('pendingLoggedActivityRef.current');
  expect(preview).toContain('sourceObjectId===followUp.changes.sourceObjectId');
  expect(preview).toContain('currentPersonalTaskScope!==localScope');
 });
});
