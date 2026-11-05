import {describe,expect,it} from 'vitest';
import {canEditTeamArea,canIssueTeamQuote} from './teamDepartments';
import {readFileSync} from 'node:fs';
const auth=readFileSync(new URL('../store/authStore.ts',import.meta.url),'utf8');
const cloud=readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');

describe('Department-scoped cloud synchronization',()=>{
  it('mirrors member permissions for CRM, Quotes and issuance credentials',()=>{
    expect(canEditTeamArea('member','estimator','quotes')).toBe(true);
    expect(canEditTeamArea('member','estimator','crm')).toBe(false);
    expect(canIssueTeamQuote('member','estimator')).toBe(false);
    expect(canEditTeamArea('member','project_manager','crm')).toBe(true);
    expect(canEditTeamArea('member','project_manager','quotes')).toBe(false);
    expect(canEditTeamArea('member','purchasing','crm')).toBe(false);
    expect(canEditTeamArea('member','purchasing','quotes')).toBe(false);
    expect(canEditTeamArea('viewer','general','crm')).toBe(false);
  });
  it('fails closed for an unknown member job function',()=>{
    expect(canEditTeamArea('member','unknown' as 'general','crm')).toBe(false);
    expect(canEditTeamArea('member','unknown' as 'general','quotes')).toBe(false);
  });
  it('restricts recovery and debounced uploads to authorized areas',()=>{
    expect(auth).toContain('allowCrmRecovery:canWriteCrm');
    expect(auth).toContain('allowQuoteRecovery:canWriteQuotes');
    expect(auth).toContain('canWriteCrm,canWriteQuotes,canWriteSignatures,');
    expect(cloud).toContain('if(!canWrite(detail.key))return;');
    expect(cloud).toContain('if(canWriteCrm&&readPendingCrmSync(scope))');
    expect(cloud).toContain('if(canWriteQuotes&&readPendingQuoteSync(scope))');
    expect(cloud).toContain('if(canWriteSignatures&&retryableFailures.has(SIGNATURES_DOCUMENT_KEY))');
  });
  it('keeps the personal Notebook writable independent of shared record permission',()=>{
    expect(cloud).toContain('const canWrite=(key:CloudDocumentKey)=>key===PRIVATE_DOCUMENT_KEY||');
    expect(cloud).toContain('if(readPendingNotebookSync(scope))');
    expect(cloud).toContain('if(retryableFailures.has(PRIVATE_DOCUMENT_KEY))');
  });
});
