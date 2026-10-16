import { describe, expect, it } from 'vitest';
import { filterTeamQuotes, summarizeTeamQuotes, validQuoteTeamAssignment, type TeamQuoteFilters } from './quoteTeamReporting';
import type { Quote } from '../types/quote';

const base: Quote = {
  id:'q1', quoteNumber:'Q-001', documentType:'quote', originalQuoteDate:'2026-10-01', quoteDate:'2026-10-01',
  revision:0,status:'Draft',title:'Private project',ownerUserId:'alice',divisionId:'commercial',teamId:'multi',
  sections:[],lines:[],customerColumns:{quantity:false,rate:false,lineAmount:true},customerNotes:'',internalNotes:'',
  history:[],createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z',
};
const filters: TeamQuoteFilters = {query:'',owner:'all',division:'all',team:'all',status:'all',showArchived:false};

describe('Team Quotes organizational ownership',()=>{
  it('does not attribute legacy/unassigned work to a salesperson',()=>{
    const unassigned = { ...base,id:'q2',ownerUserId:undefined,teamId:undefined,divisionId:undefined,status:'Sent' as const };
    const all = [base,unassigned];
    expect(filterTeamQuotes(all,{...filters,owner:'alice'}).map(q=>q.id)).toEqual(['q1']);
    expect(filterTeamQuotes(all,{...filters,owner:'unassigned'}).map(q=>q.id)).toEqual(['q2']);
    expect(summarizeTeamQuotes(all).unassigned).toBe(1);
  });
  it('filters team, division, status, search and archive without mutating quotes',()=>{
    const all=[base,{...base,id:'q2',ownerUserId:undefined,divisionId:undefined,teamId:undefined,status:'Signed' as const,title:'Second'}];
    expect(filterTeamQuotes(all,{...filters,team:'multi',division:'commercial',status:'Draft',query:'private'}).map(q=>q.id)).toEqual(['q1']);
    expect(filterTeamQuotes(all,{...filters,division:'unassigned'}).map(q=>q.id)).toEqual(['q2']);
    expect(filterTeamQuotes([{...base,archivedAt:'2026-10-05T00:00:00Z'}],filters)).toHaveLength(0);
    expect(base.archivedAt).toBeUndefined();
  });
  it('reports issued documents separately from confirmed customer delivery',()=>{
    const docs=[
      {...base,id:'issued',revision:0,status:'Sent' as const},
      {...base,id:'delivered',revision:1,status:'Sent' as const},
      {...base,id:'signed',revision:0,status:'Signed' as const},
      {...base,id:'draft',revision:0,status:'Draft' as const},
    ];
    const activities=[
      {id:'d1',type:'quote-sent' as const,quoteId:'delivered',
        occurredAt:'2026-10-14T12:00:00Z',summary:'Delivered',
        metadata:{source:'manual' as const,revision:1,deliveryConfirmed:true,deliveryMethod:'email' as const}},
      {id:'d0',type:'quote-sent' as const,quoteId:'issued',
        occurredAt:'2026-10-14T11:00:00Z',summary:'Issued',
        metadata:{source:'quote' as const,revision:0}},
      {id:'old',type:'quote-sent' as const,quoteId:'issued',
        occurredAt:'2026-10-13T12:00:00Z',summary:'Prior revision delivered',
        metadata:{source:'manual' as const,revision:2,deliveryConfirmed:true}},
    ];
    const report=summarizeTeamQuotes(docs,activities);
    expect(report.issued).toBe(3);
    expect(report.delivered).toBe(1);
    expect(report.active).toBe(1);
    expect(report.signed).toBe(1);
  });
  it('blocks cross-division team or non-member owner assignment',()=>{
    const members=[{user_id:'alice',displayName:'Alice',role:'member',jobFunction:'salesperson'}];
    const divisions=[{id:'commercial',organization_id:'org',name:'Commercial'}];
    const teams=[{id:'multi',organization_id:'org',division_id:'commercial',name:'Multifamily'}];
    expect(validQuoteTeamAssignment('alice','commercial','multi',members,divisions,teams)).toBe(true);
    expect(validQuoteTeamAssignment('outsider','commercial','multi',members,divisions,teams)).toBe(false);
    expect(validQuoteTeamAssignment('alice','retail','multi',members,divisions,teams)).toBe(false);
  });
});
