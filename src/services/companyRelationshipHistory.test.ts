import {describe,expect,it} from 'vitest';
import type {Company,Contact,Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';
import {companyRelationshipHistory,companyHistoryByFilter} from './companyRelationshipHistory';

const company={id:'co',name:'Acme',createdAt:'2026-01-01',updatedAt:'2026-11-01'} as Company;
const person={id:'p',companyId:'co',name:'Alex'} as Contact;
const deal={id:'d',companyId:'co',name:'Building A',stage:'Discovery',
 createdAt:'2026-10-20T13:00:00Z',updatedAt:'2026-11-08T13:00:00Z'} as Project;
const doc={id:'q',projectId:'d',title:'Kitchen scope',quoteNumber:'Q-12',status:'Sent',
 createdAt:'2026-10-21T12:00:00Z',sentAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z'} as Quote;
const activity=(id:string,type:Activity['type'],occurredAt:string,
 patch:Partial<Activity>={}):Activity=>({id,type,summary:id,occurredAt,...patch});
const followUp={id:'f',title:'Call Alex',workspaceScope:'personal',
 createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z',
 dueDate:'2026-11-12',status:'open',type:'follow-up',
 associations:[{type:'contact' as const,id:'p',label:'Person · Alex'}]} as PersonalTask;

describe('Company unified relationship history',()=>{
 it('includes linked Person interactions and external sent Quotes once with target navigation',()=>{
  const events=[
   activity('call','manual-touchpoint','2026-11-02T18:00:00Z',{
    contactId:'p',companyId:'co',metadata:{interactionMethod:'call'}}),
   activity('external','quote-sent','2026-11-06T18:00:00Z',{
    projectId:'d',metadata:{externalQuoteSent:true,externalQuoteFormat:'pdf'}}),
   activity('qsent','quote-sent','2026-11-01T12:00:00Z',{quoteId:'q',projectId:'d'}),
   activity('created','quote-created','2026-10-21T12:00:00Z',{quoteId:'q',projectId:'d'}),
   activity('createddeal','project-created','2026-10-20T13:00:00Z',{projectId:'d'}),
  ];
  const timeline=companyRelationshipHistory({company,contacts:[person],projects:[deal],
   activities:events,quotes:[doc]});
  expect(timeline.map(item=>item.id)).toEqual([
   'activity:external','activity:call','activity:qsent','activity:created','activity:createddeal']);
  expect(timeline.find(item=>item.id==='activity:external')).toMatchObject({
   category:'quote',title:'External quote sent',target:{kind:'activity',id:'external'}});
  expect(timeline.find(item=>item.id==='activity:call')).toMatchObject({
   category:'interaction',target:{kind:'activity',id:'call'}});
  expect(companyHistoryByFilter(timeline,'interactions').map(item=>item.id)).toEqual(['activity:call']);
 });
 it('includes metadata-only links, deduplicates multi-linked Activities, and excludes namesakes',()=>{
  const events=[
   activity('multi','manual-touchpoint','2026-11-08T12:00:00Z',{
    metadata:{interactionMethod:'text',relatedRecords:[
     {type:'contact',id:'p'},{type:'project',id:'d'},{type:'company',id:'co'}]}}),
   activity('unrelated','manual-touchpoint','2026-11-09T12:00:00Z',{
    companyId:'different',summary:'Acme'}),
  ];
  const timeline=companyRelationshipHistory({company,contacts:[person],projects:[deal],
   activities:events,quotes:[]});
  expect(timeline.filter(item=>item.id==='activity:multi')).toHaveLength(1);
  expect(timeline.some(item=>item.id==='activity:unrelated')).toBe(false);
 });
 it('includes only the active personal scope Tasks linked by Company, Person, Deal or Quote',()=>{
  const other={...followUp,id:'elsewhere',workspaceScope:'other'};
  const timeline=companyRelationshipHistory({company,contacts:[person],projects:[deal],
   activities:[],quotes:[doc],tasks:[followUp,other],personalTaskScope:'personal'});
  expect(timeline.filter(item=>item.category==='task').map(item=>item.id)).toEqual(['task:f']);
  expect(timeline.find(item=>item.id==='task:f')).toMatchObject({
   pending:true,target:{kind:'task',id:'f'}});
  expect(companyRelationshipHistory({company,contacts:[person],projects:[deal],
   activities:[],quotes:[],tasks:[followUp]}).some(item=>item.category==='task')).toBe(false);
 });
 it('does not leak unseen or archived quote snapshots or double count sentAt',()=>{
  const hidden={...doc,id:'hidden',companyId:'different',projectId:'elsewhere'} as Quote;
  const archived={...doc,id:'archived',archivedAt:'2026-11-01'} as Quote;
  const timeline=companyRelationshipHistory({company,contacts:[person],projects:[deal],
   activities:[activity('sent','quote-sent','2026-11-01T12:00:00Z',{quoteId:'q'})],
   quotes:[doc,hidden,archived]});
  expect(timeline.filter(item=>item.id==='quote-sent:q')).toHaveLength(0);
  expect(timeline.some(item=>item.id.includes('hidden')||item.id.includes('archived'))).toBe(false);
 });
});
