import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {CrmDocument} from '../types/crm';
import {syncNormalizedCrm} from './normalizedCrmSync';

type Row=Record<string,unknown>;
const fixture=vi.hoisted(()=>({
  rows:{companies:[] as Row[],contacts:[] as Row[],projects:[] as Row[],activities:[] as Row[]},
  reads:[] as {table:string;columns:string;start:number;end:number;order:string[]}[],
  writes:[] as {table:string;rows:Row[]}[],
}));
vi.mock('../lib/supabase',()=>({
  supabase:{
    from(table:keyof typeof fixture.rows){
      return {
        select(columns:string){
          const order:string[]=[];
          const query={
            eq(_field:string,_value:string){return query;},
            order(field:string){order.push(field);return query;},
            async range(start:number,end:number){
              fixture.reads.push({table,columns,start,end,order:order.slice()});
              return {data:fixture.rows[table].slice(start,end+1),error:null};
            },
          };
          return query;
        },
        async upsert(rows:Row[]){
          fixture.writes.push({table,rows});
          return {error:null};
        },
      };
    },
  },
}));

const older='2026-11-05T10:00:00Z',newer='2026-11-05T14:00:00Z';
const doc=(records:Partial<CrmDocument>):CrmDocument=>({
  schemaVersion:3,companies:[],contacts:[],projects:[],activities:[],...records,
});
beforeEach(()=>{
  fixture.reads.length=0;
  fixture.writes.length=0;
  for(const key of Object.keys(fixture.rows) as Array<keyof typeof fixture.rows>)
    fixture.rows[key]=[];
});

describe('CRM server-side conflict checks with large workspaces',()=>{
  it('pages all company, contact and Deal guards, even beyond row 1,000',async()=>{
    for(const table of ['companies','contacts','projects'] as const){
      fixture.rows[table]=Array.from({length:1101},(_,i)=>({
        id:table+'-'+i,updated_at:newer,stage:'Closed Won',
        assigned_user_id:'staff-a',amount:250000,
      }));
    }
    await syncNormalizedCrm('shop',doc({
      companies:[{id:'companies-1050',name:'Old account',kind:'customer',createdAt:older,updatedAt:older}],
      contacts:[{id:'contacts-1050',name:'Old contact',createdAt:older,updatedAt:older}],
      projects:[{id:'projects-1050',name:'Old deal',stage:'Discovery',createdAt:older,updatedAt:older}],
    }));
    expect(fixture.writes).toEqual([]);
    for(const table of ['companies','contacts','projects']){
      expect(fixture.reads.filter(read=>read.table===table).map(r=>[r.start,r.end]))
        .toEqual([[0,499],[500,999],[1000,1499]]);
      expect(fixture.reads.filter(read=>read.table===table).every(r=>r.order.join(',')==='id')).toBe(true);
    }
  });

  it('persists new CRM rows while retaining authoritative assignment on existing Deals',async()=>{
    fixture.rows.projects=[{
      id:'existing',updated_at:older,stage:'Completed',
      assigned_user_id:'staff-b',amount:150000,
    }];
    await syncNormalizedCrm('shop',doc({
      companies:[{id:'new-company',name:'New account',kind:'customer',createdAt:newer,updatedAt:newer}],
      projects:[{id:'existing',name:'Updated deal',stage:'Discovery',amount:100000,
        assignedUserId:'old-staff',createdAt:older,updatedAt:newer}],
    }));
    const companies=fixture.writes.find(x=>x.table==='companies')?.rows??[];
    const projects=fixture.writes.find(x=>x.table==='projects')?.rows??[];
    expect(companies).toHaveLength(1);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      stage:'Completed',assigned_user_id:'staff-b',amount:150000,
    });
  });
});
