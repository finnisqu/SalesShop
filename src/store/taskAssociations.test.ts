import {describe,it,expect} from 'vitest';
import {normalizedTaskAssociations,taskAssociationKey,type PersonalTask} from './personalTaskStore';
describe('task associations',()=>{
 it('keeps legacy linked records without modifying them',()=>{
  const input={linked:{type:'company' as const,id:'company-1'},sourceLabel:'Builder'};
  expect(normalizedTaskAssociations(input)).toEqual([{type:'company',id:'company-1',label:'Builder'}]);
 });
 it('deduplicates multi-record associations while retaining their order',()=>{
  const input={associations:[{type:'company' as const,id:'a',label:'A'},
   {type:'contact' as const,id:'p',label:'P'},{type:'company' as const,id:'a',label:'Duplicate'}]};
  expect(normalizedTaskAssociations(input as PersonalTask)).toHaveLength(2);
  expect(taskAssociationKey(input.associations[1])).toBe('contact:p');
 });
});