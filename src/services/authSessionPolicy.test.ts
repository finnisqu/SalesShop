import {describe,expect,it} from 'vitest';
import {reuseReadyWorkspace,type WorkspaceAuthSnapshot} from './authSessionPolicy';

const ready:WorkspaceAuthSnapshot={
 ready:true,busy:false,mode:'cloud',userId:'user-a',
 organizationId:'org-a',platformRole:null,inviteProblem:null,
};
describe('non-destructive auth reconfirmations',()=>{
 it('keeps current user workspace on sign-in reconfirmation and refresh',()=>{
  expect(reuseReadyWorkspace(ready,'user-a')).toBe(true);
  expect(reuseReadyWorkspace({...ready,organizationId:null,platformRole:'developer'},'user-a')).toBe(true);
 });
 it('bootstraps when the account or signed-in workspace changes',()=>{
  expect(reuseReadyWorkspace(ready,'user-b')).toBe(false);
  expect(reuseReadyWorkspace(ready,null)).toBe(false);
  expect(reuseReadyWorkspace({...ready,ready:false},'user-a')).toBe(false);
  expect(reuseReadyWorkspace({...ready,busy:true},'user-a')).toBe(false);
  expect(reuseReadyWorkspace({...ready,organizationId:null},'user-a')).toBe(false);
  expect(reuseReadyWorkspace({...ready,inviteProblem:'unavailable'},'user-a')).toBe(false);
  expect(reuseReadyWorkspace({...ready,mode:'local'},'user-a')).toBe(false);
 });
});
