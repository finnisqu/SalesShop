import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {mayUploadCrmEntity} from './crmOwnerSyncGuard';

const file=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const sql=file('supabase/migrations/20261015162000_private_crm_ownership_gate.sql');
const sync=file('src/services/normalizedCrmSync.ts');
const store=file('src/store/crmStore.ts');

describe('private CRM ownership and cloud sync compatibility',()=>{
  it('prevents admin or other salesperson cached edits once private RLS is enabled',()=>{
    expect(mayUploadCrmEntity('alice','alice',true)).toBe(true);
    expect(mayUploadCrmEntity('alice','bob',true)).toBe(false);
    expect(mayUploadCrmEntity('alice',undefined,true)).toBe(false);
    expect(mayUploadCrmEntity(undefined,'alice',true)).toBe(false);
    expect(mayUploadCrmEntity(undefined,undefined,true)).toBe(false);
    expect(mayUploadCrmEntity(undefined,undefined,false)).toBe(true);
  });
  it('retains old-schema compatibility while the migration flag is off',()=>{
    expect(file('src/services/crmPrivacyPilot.ts')).toContain("VITE_PRIVATE_CRM_RLS==='1'");
    expect(sync).toContain('mayUploadCrmEntity(record.ownerUserId,actorId,privateCrmRlsEnabled)');
    expect(sync).toContain('auth.organizationId===organizationId');
    expect(sync).toContain('auth.organizationId===null && bootstrapUserId===auth.user?.id');
    expect(sync).toContain('activeWorkspace||verifiedBootstrap');
    expect(file('src/services/cloudSync.ts')).toContain('syncNormalizedCrm(orgId, localCrm, userId)');
    expect(sync).toContain('privateCrmRlsEnabled?{owner_user_id:');
    expect(sync).toContain('ownerUserId: valueOrUndefined(row.owner_user_id)');
  });
  it('new Cloud CRM entries are attributed to the signed-in actor',()=>{
    expect(store).toContain('ownerUserId: crmOwnerId()');
    expect(store).toContain('ownerUserId: crmOwnerId() ?? input.ownerUserId');
    expect(store).not.toContain('ownerUserId: input.ownerUserId ?? crmOwnerId()');
  });
  it('preserves legacy unknown owners, explicit grant authorization and cross-entity reference limits',()=>{
    for(const table of ['companies','contacts','projects','activities']){
      expect(sql).toContain('alter table public.'+table+' add column if not exists owner_user_id uuid');
      expect(sql).toContain('alter policy '+table+'_read_org on public.'+table);
      expect(sql).toContain('alter policy '+table+'_insert_editor on public.'+table);
      expect(sql).toContain('alter policy '+table+'_update_editor on public.'+table);
      expect(sql).toContain('alter policy '+table+'_delete_editor on public.'+table);
      expect(sql).toContain('create trigger '+table+'_owner_immutable');
    }
    expect(sql).toContain('private.can_read_crm_entity');
    expect(sql).toContain('private.can_edit_crm_entity');
    expect(sql).toContain('private.can_reference_crm');
    expect(sql).toContain('public.crm_access_grants');
    expect(sql).toContain('public.assign_unowned_crm_record');
    expect(sql).toContain('private.crm_recovery_audit');
    expect(sql).not.toContain('update public.companies set owner_user_id=');
    expect(sql).not.toContain('update public.contacts set owner_user_id=');
  });
});
