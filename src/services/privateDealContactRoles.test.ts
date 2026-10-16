import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ownedQuoteContactIds,isPrivateDealRole,PRIVATE_DEAL_CONTACT_ROLES} from './privateDealContactRoles';
import type {Quote} from '../types/quote';

const sql=readFileSync(join(process.cwd(),'supabase/migrations/20261015173000_private_deal_contact_roles.sql'),'utf8');
describe('Private Deal contact role permissions gate',()=>{
  it('allows candidate contacts only from own unarchived Deal quotes',()=>{
    const quotes=[
      {id:'q1',projectId:'d1',contactId:'a',ownerUserId:'me'},
      {id:'q2',projectId:'d1',contactId:'a',ownerUserId:'me'},
      {id:'q3',projectId:'d1',contactId:'b',ownerUserId:'other'},
      {id:'q4',projectId:'d2',contactId:'c',ownerUserId:'me'},
      {id:'q5',projectId:'d1',contactId:'d',ownerUserId:'me',archivedAt:'2026-10-14'},
    ] as Quote[];
    expect(ownedQuoteContactIds('d1','me',quotes)).toEqual(['a']);
    expect(ownedQuoteContactIds('d1',null,quotes)).toEqual([]);
    expect(ownedQuoteContactIds('d1','other',quotes)).toEqual(['b']);
  });
  it('accepts only known role labels',()=>{
    expect(PRIVATE_DEAL_CONTACT_ROLES).toContain('Estimator');
    expect(isPrivateDealRole('Estimator')).toBe(true);
    expect(isPrivateDealRole('owner')).toBe(false);
  });
  it('requires a real signed-in staging role-matrix read gate for private Deal labels',()=>{
    const staged=readFileSync(join(process.cwd(),'scripts/security/staging-role-matrix.mjs'),'utf8');
    expect(staged).toContain("parsed.hostname==='pvchgibllozuwickhfqz.supabase.co'");
    expect(staged).toContain("from('deal_contact_roles')");
    expect(staged).toContain('privateRolesForA.length===1');
    expect(staged).toContain("sessions.salesperson_a.user.id");
    expect(staged).toContain("['salesperson_b','owner','admin','viewer','outsider']");
    expect(staged).toContain("records.length===0");
  });
  it('creates a separate table with NO organization-wide CRM authorization inheritance',()=>{
    expect(sql).toContain('STAGED ONLY');
    expect(sql).toContain('create table public.deal_contact_roles');
    expect(sql).toContain('alter table public.deal_contact_roles enable row level security');
    expect(sql).toContain('p_owner=(select auth.uid())');
    expect(sql).toContain('q.owner_user_id=(select auth.uid())');
    expect(sql).toContain('q.project_id=p_deal and q.contact_id=p_contact');
    expect(sql).toContain("private.can_edit_org_area(p_org,'quotes')");
    expect(sql).not.toContain('private.is_org_member(organization_id)');
    for(const policy of ['select_own','insert_own','update_own','delete_own'])
      expect(sql).toContain('deal_contact_roles_'+policy);
    expect(sql).not.toContain('on public.projects for');
    expect(sql).not.toContain('on public.contacts for');
    expect(sql.trim()).toMatch(/^-- Batch 17G STAGED ONLY/);
    expect(sql.trim().endsWith('commit;')).toBe(true);
  });
});
