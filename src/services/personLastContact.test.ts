import {describe,expect,it} from 'vitest';
import type {Activity} from '../types/crm';
import {personLastContactIndex} from './personLastContact';

const event=(id:string,type:Activity['type'],occurredAt:string,
 extra:Partial<Activity>={}):Activity=>({
 id,type,occurredAt,summary:id,...extra,
});

describe('Person last contacted mobile summary',()=>{
 it('uses the newest actual completed touchpoint, not record creation or system events',()=>{
  const history=[
   event('created','contact-created','2026-11-08T18:00:00Z',{contactId:'person-1'}),
   event('old','manual-touchpoint','2026-11-05T15:30:00Z',{
    contactId:'person-1',metadata:{interactionMethod:'call'}}),
   event('system','quote-sent','2026-11-09T18:00:00Z',{contactId:'person-1'}),
   event('new','notebook-touchpoint','2026-11-07T10:00:00Z',{
    contactId:'person-1',metadata:{interactionMethod:'email'}}),
  ];
  const last=personLastContactIndex(history).get('person-1');
  expect(last).toMatchObject({occurredAt:'2026-11-07T10:00:00Z',method:'email'});
 });
 it('finds people in linked-record metadata even without a legacy contactId',()=>{
  const history=[event('text','manual-touchpoint','2026-11-06T12:00:00Z',{
   metadata:{interactionMethod:'text',relatedRecords:[{type:'company',id:'co'},
    {type:'contact',id:'person-2'}, {type:'contact',id:'person-3'}]},
  })];
  const last=personLastContactIndex(history);
  expect(last.get('person-2')?.method).toBe('text');
  expect(last.get('person-3')?.method).toBe('text');
  expect(last.has('co')).toBe(false);
 });
 it('keeps never-contacted people absent and ignores bad/future dates',()=>{
  const history=[
   event('creation','contact-created','2026-11-01T12:00:00Z',{contactId:'person-4'}),
   event('invalid','manual-touchpoint','not-a-date',{contactId:'person-5'}),
   event('future','manual-touchpoint','2099-01-01T12:00:00Z',{contactId:'person-5'}),
  ];
  const last=personLastContactIndex(history);
  expect(last.has('person-4')).toBe(false);
  expect(last.has('person-5')).toBe(false);
 });
});
