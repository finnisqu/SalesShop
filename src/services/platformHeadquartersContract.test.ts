import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  blankNotebook,blankCrm,cleanNotebook,cleanCrm,remainingFollowUps,SALES_STAGES,
} from '../platform/headquartersTypes';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const migration=read('supabase/migrations/202610120001_platform_headquarters.sql');

describe('Platform Headquarters authorization and document contracts',()=>{
  it('stores per-Developer Notebook/CRM in a private RLS-enabled table, not tenant tables',()=>{
    expect(migration).toContain('create table private.platform_workspace_documents');
    expect(migration).toContain('owner_user_id uuid not null references auth.users');
    expect(migration).toContain('primary key (owner_user_id,document_kind)');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table private.platform_workspace_documents from public,anon,authenticated');
    expect(migration).not.toContain('insert into public.organizations');
    expect(migration).not.toContain('from public.quotes');
    expect(migration).not.toContain('from public.contacts');
    expect(migration).not.toContain('from public.organization_members');
  });
  it('protects both RPCs behind server-side Developer identity and per-user identity scoping',()=>{
    expect(migration.match(/if not private\.is_platform_developer\(\)/g)?.length).toBe(2);
    expect(migration.match(/\(select auth\.uid\(\)\)/g?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain('p_expected_revision');
    expect(migration).toContain('revision=p_expected_revision');
    expect(migration).toContain("using errcode='40001'");
    expect(migration).toContain("grant execute on function public.platform_hq_save_document(text,jsonb,bigint) to authenticated;");
  });
  it('keeps Notebook and CRM schemas normalized and rejects foreign CRM links',()=>{
    expect(blankNotebook()).toEqual({schemaVersion:1,pages:[],activePageId:null});
    expect(cleanNotebook({schemaVersion:1,pages:[{id:'a',title:'Notes',contentHtml:'<p>test</p>'}],activePageId:'invalid'}).activePageId).toBe('a');
    expect(blankCrm().accounts).toEqual([]);
    const doc=cleanCrm({schemaVersion:1,accounts:[{id:'a',name:'Sample',stage:'Lead'}],
      contacts:[{id:'c',accountId:'not-a-company'},{id:'d',accountId:'a'}],
      activities:[{id:'e',accountId:'not-a-company'}]});
    expect(doc.accounts).toHaveLength(1);
    expect(doc.contacts).toHaveLength(1);
    expect(doc.activities).toHaveLength(0);
    expect(SALES_STAGES).toContain('Customer');
  });
  it('exposes only real private follow-up counts, excluding cold and lost stages',()=>{
    const base={id:'a',name:'Demo',stage:'Lead' as const,source:'',website:'',
      notes:'',nextAction:'',followUpDate:'2026-10-10',tenantOrganizationId:null,createdAt:'',updatedAt:''};
    const doc={...blankCrm(),accounts:[base,{...base,id:'b',stage:'Lost' as const},
      {...base,id:'c',followUpDate:'2026-10-15'}]};
    expect(remainingFollowUps(doc,'2026-10-12')).toHaveLength(1);
  });
  it('renders Headquarters independently of customer stores, with existing cloud metadata only',()=>{
    const console=read('src/components/DeveloperConsole.tsx');
    const data=read('src/platform/useHeadquartersDocument.ts');
    expect(console).toContain('<HeadquartersNotebook store={notebookStore}/>');
    expect(console).toContain('<HeadquartersCrm store={crmStore}');
    expect(console).toContain('Product usage metrics');
    expect(console).toContain('Not collected yet');
    expect(data).toContain("supabase.rpc('platform_hq_get_document'");
    expect(data).toContain("supabase.rpc('platform_hq_save_document'");
    for (const forbidden of ['useCrmStore','useQuoteStore','useNotebookStore',
      "from('quotes')","from('organization_members')","from('contacts')"]){
      expect(data).not.toContain(forbidden);
    }
  });
});
