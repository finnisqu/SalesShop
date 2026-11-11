import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const sync=read('src/services/normalizedQuoteSync.ts');
const cloud=read('src/services/cloudSync.ts');
const team=read('src/components/TeamQuotesWorkspace.tsx');

describe('Batch 14D private quote sync and ownership contract',()=>{
  it('refuses to upload teammate quotes even for owner/admin and checks org session',()=>{
    expect(sync).toContain('auth.organizationId === organizationId');
    expect(sync).toContain('auth.organizationId === null && bootstrapUserId === auth.user?.id');
    expect(sync).toContain('(activeWorkspace || verifiedBootstrap)');
    expect(sync).toContain('quote.ownerUserId === actorId');
    expect(sync).not.toContain('(isAdmin ||');
    expect(sync).toContain('atLeastAsNew(quote.updatedAt');
  });
  it('never seeds a different owner quote from local browser storage',()=>{
    expect(cloud).toContain('const canSeedOrgFromLocal = options.allowCompanySeed === true && !previousScope;');
    expect(cloud).toContain('localQuotes.quotes.every(quote=>quote.ownerUserId===userId)');
    expect(cloud).toContain('starterQuoteDocument(userId)');
    expect(cloud).toContain('syncNormalizedQuotes(orgId, starter, userId)');
    expect(cloud).toContain('syncNormalizedQuotes(orgId, localQuotes, userId)');
    expect(cloud).toContain('ownerUserId: userId');
    expect(cloud).not.toContain('starterQuoteDocument()');
  });
  it('does not transfer an attributed salesperson quote in Team Quotes',()=>{
    expect(team).toContain('selected.ownerUserId!==currentUserId');
    expect(team).toContain('owner!==selected.ownerUserId');
    expect(team).not.toContain('.update({owner_user_id:owner');
    expect(team).toContain(".update({division_id:division,team_id:team})");
    expect(team).toContain(".eq('owner_user_id',currentUserId)");
  });
  it('recovers only truly unassigned quote ownership through explicit server audit',()=>{
    expect(team).toContain("supabase.rpc('assign_unowned_quote'");
    expect(team).toContain('target_organization:organizationId');
    expect(team).toContain('target_quote_id:selected.id');
    expect(team).toContain('target_user_id:owner');
    expect(team).toContain('Legacy quote recovery is not available yet');
  });
  it('limits read grants to the actual owner and does not infer access from teams',()=>{
    expect(team).toContain('selected?.ownerUserId!==currentUserId');
    expect(team).toContain('selected.ownerUserId===currentUserId');
    expect(team).toContain('Team membership alone does not share a private quote.');
  });
});
