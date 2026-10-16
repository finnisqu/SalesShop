import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {createQuoteRevisionSnapshot} from './quoteIntegrity';
import {frozenRevisionTotal,historicalCustomerQuote} from './quoteRevisionView';
import {buildAcceptedQuoteSnapshot} from '../types/signature';

const t='2026-10-15T19:00:00Z';
const original=():Quote=>({
  id:'quote-1',quoteNumber:'WS-230',documentType:'quote',
  originalQuoteDate:'2026-10-15',quoteDate:'2026-10-15',
  revision:0,status:'Sent',title:'Kitchen 1',companyName:'Initial Builder',
  companyId:'company-1',customerNotes:'Original payment terms',
  projectMaterials:[{id:'pm-1',label:'Quartz White'}],attachSelectionsSheet:true,
  sections:[{id:'k',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail'}],
  lines:[
    {id:'top',sectionId:'k',kind:'material',description:'Quartz White',
      pricingMode:'quantity-rate',quantity:20,rate:50,includeInTotal:true,customerVisible:true},
    {id:'sink',sectionId:'k',kind:'sink',description:'Undisclosed sink',pricingMode:'direct',
      amount:220,includeInTotal:true,customerVisible:false,internalCost:98},
    {id:'discount',kind:'discount',description:'Builder discount',pricingMode:'direct',
      amount:50,includeInTotal:true,customerVisible:true},
  ],
  customerColumns:{quantity:true,rate:true,lineAmount:true},
  internalNotes:'Private margin notes',history:[],
  createdAt:t,updatedAt:t,
});
describe('18F frozen revision reconstruction and signatures',()=>{
  it('captures a deep independent project-material shortlist, lines, document columns and terms',()=>{
    const q=original(),snapshot=createQuoteRevisionSnapshot(q,t,'Sent');
    q.projectMaterials![0].label='Newer gold marble';
    q.sections[0].title='Modified kitchen';
    q.lines[0].rate=900;
    q.customerColumns.rate=false;
    q.customerNotes='Changed warranty';
    expect(snapshot.projectMaterials?.[0].label).toBe('Quartz White');
    expect(snapshot.sections[0].title).toBe('Kitchen');
    expect(snapshot.lines[0].rate).toBe(50);
    expect(snapshot.customerColumns.rate).toBe(true);
    expect(snapshot.customerNotes).toBe('Original payment terms');
    expect(snapshot.customerTotal).toBe(1170);
  });
  it('reconstructs an older revision without carrying live quote/private data forward',()=>{
    const initial=original();
    const old=createQuoteRevisionSnapshot(initial,t,'Sent');
    const live={...initial,revision:1,status:'Draft' as const,title:'Island revision',
      companyName:'Changed Builder',customerNotes:'Changed terms',updatedAt:'2026-10-16T19:00:00Z',
      projectMaterials:[{id:'pm-new',label:'New black granite'}],
      attachSelectionsSheet:false,sections:[{...initial.sections[0],title:'New Island'}],
      lines:initial.lines.map(l=>l.id==='top'?{...l,rate:75}:l),history:[old],
      archivedAt:'2026-10-16T21:00:00Z',
    };
    const restored=historicalCustomerQuote(live,old);
    expect(restored.id).toBe('quote-1');
    expect(restored.status).toBe('Sent');
    expect(restored.revision).toBe(0);
    expect(restored.title).toBe('Kitchen 1');
    expect(restored.companyName).toBe('Initial Builder');
    expect(restored.customerNotes).toBe('Original payment terms');
    expect(restored.projectMaterials?.map(x=>x.label)).toEqual(['Quartz White']);
    expect(restored.attachSelectionsSheet).toBe(true);
    expect(restored.sections[0].title).toBe('Kitchen');
    expect(quoteTotal(restored)).toBe(1170);
    expect(frozenRevisionTotal(old)).toBe(old.customerTotal);
    expect(restored.internalNotes).toBe('');
    expect(restored.archivedAt).toBeUndefined();
    expect(restored.history).toEqual([]);
    restored.lines[0].rate=5;
    expect(live.lines[0].rate).toBe(75);
    expect(old.lines[0].rate).toBe(50);
  });
  it('old snapshots missing optional materials and selections do not inherit newer draft choices',()=>{
    const q=original();
    const legacy=createQuoteRevisionSnapshot(q,t,'Sent');
    delete legacy.projectMaterials;
    delete legacy.attachSelectionsSheet;
    const preview=historicalCustomerQuote({...q,projectMaterials:[{id:'new',label:'Newer color'}]},legacy);
    expect(preview.projectMaterials).toEqual([]);
    expect(preview.attachSelectionsSheet).toBe(false);
  });
  it('accepted receipt prices, customer scope and terms bind to the frozen issued revision',()=>{
    const issued=original();
    issued.history=[createQuoteRevisionSnapshot(issued,t,'Sent')];
    // A later in-memory mutation must not alter the acceptance receipt.
    issued.lines[0].rate=800;
    issued.title='In-memory changed quote';
    issued.customerNotes='Changed terms';
    const receipt=buildAcceptedQuoteSnapshot(issued);
    expect(receipt.acceptedTotal).toBe(1170);
    expect(receipt.title).toBe('Kitchen 1');
    expect(receipt.customerNotes).toBe('Original payment terms');
    expect(receipt.lines.find(l=>l.id==='top')?.rate).toBe(50);
    expect(receipt.lines.some(l=>l.id==='sink')).toBe(false);
    expect(receipt.revision).toBe(0);
    expect(receipt.quoteNumber).toBe('WS-230');
  });
  it('captures two distinct issued revisions and never replaces the first signed-ready snapshot',()=>{
    let q=original();
    const first=createQuoteRevisionSnapshot(q,t,'Sent');
    q={...q,revision:1,status:'Sent',title:'Kitchen revised',
      lines:q.lines.map(l=>l.id==='top'?{...l,rate:60}:l),
      quoteDate:'2026-10-16'};
    const second=createQuoteRevisionSnapshot(q,'2026-10-16T20:00:00Z','Sent');
    q={...q,revision:2,status:'Draft',history:[first,second],
      title:'Third draft',customerNotes:'New draft terms',archivedAt:'2026-10-17T00:00:00Z'};
    expect(q.history.map(x=>x.revision)).toEqual([0,1]);
    const prior=historicalCustomerQuote(q,q.history[0]);
    const later=historicalCustomerQuote(q,q.history[1]);
    expect([quoteTotal(prior),quoteTotal(later)]).toEqual([1170,1370]);
    expect(prior.title).toBe('Kitchen 1');
    expect(later.title).toBe('Kitchen revised');
    expect(prior.customerNotes).toBe('Original payment terms');
  });
});
