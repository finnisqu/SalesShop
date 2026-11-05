import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Project} from '../types/crm';
import {useCrmStore} from './crmStore';

vi.mock('../data/crmRepository',()=>({
  localCrmRepository:{load:vi.fn(()=>null),save:vi.fn()},
}));

const startingDeal:Project={
  id:'deal-a',name:'Stone package',stage:'Discovery',pipeline:'commercial',
  amount:125000,createdAt:'2026-11-05T12:00:00.000Z',
  updatedAt:'2026-11-05T12:00:00.000Z',
};
const current=()=>useCrmStore.getState().projects.find(p=>p.id==='deal-a')!;

describe('CRM Deal inline and partial edit data integrity',()=>{
  beforeEach(()=>{
    useCrmStore.setState({hydrated:true,companies:[],contacts:[],
      projects:[{...startingDeal}],activities:[]});
  });

  it('keeps the deal amount and pipeline on stage-only mobile edits',()=>{
    useCrmStore.getState().updateProject('deal-a',{stage:'Bid Sent'},{source:'manual'});
    expect(current()).toMatchObject({stage:'Bid Sent',amount:125000,pipeline:'commercial'});
    const events=useCrmStore.getState().activities;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({type:'project-stage-changed',projectId:'deal-a'});
    expect(events[0].metadata).toMatchObject({fromStage:'Discovery',toStage:'Bid Sent',source:'manual'});
  });

  it('keeps the deal amount when editing name, due date and pipeline',()=>{
    useCrmStore.getState().updateProject('deal-a',{
      name:'Updated stone package',dueDate:'2026-11-20',pipeline:'multifamily',
    });
    expect(current()).toMatchObject({amount:125000,name:'Updated stone package',
      dueDate:'2026-11-20',pipeline:'multifamily'});
    expect(useCrmStore.getState().activities).toHaveLength(0);
  });

  it('supports setting zero and intentionally clearing an amount',()=>{
    useCrmStore.getState().updateProject('deal-a',{amount:0});
    expect(current().amount).toBe(0);
    useCrmStore.getState().updateProject('deal-a',{amount:undefined});
    expect(current().amount).toBeUndefined();
  });

  it('rejects invalid numeric values without altering a valid amount',()=>{
    useCrmStore.getState().updateProject('deal-a',{amount:Infinity});
    expect(current().amount).toBe(125000);
    useCrmStore.getState().updateProject('deal-a',{amount:Number.NaN});
    expect(current().amount).toBe(125000);
  });

  it('does not create an orphan company when a missing Deal is edited',()=>{
    useCrmStore.getState().updateProject('missing-deal',{companyName:'New contractor'});
    expect(useCrmStore.getState().companies).toHaveLength(0);
    expect(useCrmStore.getState().projects).toHaveLength(1);
  });
});
