import {describe,expect,it} from 'vitest';
import {quoteHandoffStatus} from './quoteHandoffStatus';

const quote=(status:'Draft'|'Sent'|'Viewed'|'Signed',revision=0)=>({status,revision});
const link=(revision=0,viewCount=0,status:'active'|'revoked'|'signed'='active',expiresAt:string|null=null)=>({
  revision,viewCount,status,expiresAt,signedAt:status==='signed'?'2026-10-15T12:00:00.000Z':null,
});

describe('QUOTES issue-to-customer handoff status',()=>{
  it('never treats issuance or link creation as delivery',()=>{
    const issued=quoteHandoffStatus(quote('Sent'),null,false);
    expect(issued.headline).toBe('Issued · not yet delivered');
    expect(issued.deliveryConfirmed).toBe(false);
    expect(issued.linkCreated).toBe(false);
    const linked=quoteHandoffStatus(quote('Sent'),link(),false);
    expect(linked.headline).toBe('Customer link created');
    expect(linked.deliveryConfirmed).toBe(false);
    expect(linked.viewed).toBe(false);
  });
  it('does not imply manually confirmed delivery merely because the link was opened',()=>{
    const progress=quoteHandoffStatus(quote('Viewed'),link(0,2),false);
    expect(progress.headline).toBe('Customer viewed');
    expect(progress.detail).toContain('not been confirmed');
    expect(progress.deliveryConfirmed).toBe(false);
  });
  it('only counts links for the current revision',()=>{
    const progress=quoteHandoffStatus(quote('Sent',3),link(2,9),false);
    expect(progress.linkCreated).toBe(false);
    expect(progress.viewed).toBe(false);
    expect(progress.headline).toBe('Issued · not yet delivered');
  });
  it('keeps delivery confirmation and link viewing as independent milestones',()=>{
    const done=quoteHandoffStatus(quote('Sent'),null,true);
    expect(done.headline).toBe('Delivery confirmed');
    expect(done.viewed).toBe(false);
    expect(done.linkCreated).toBe(false);
  });
  it('distinguishes revoked links from shareable ones',()=>{
    const revoked=quoteHandoffStatus(quote('Sent'),link(0,0,'revoked'),false);
    expect(revoked.linkRevoked).toBe(true);
    expect(revoked.headline).toBe('Customer link revoked');
  });
  it('blocks sharing an expired active link and prompts a replacement',()=>{
    const expired=quoteHandoffStatus(quote('Sent'),link(0,2,'active','2020-01-01T00:00:00Z'),false);
    expect(expired.linkCreated).toBe(true);
    expect(expired.linkExpired).toBe(true);
    expect(expired.linkUsable).toBe(false);
    expect(expired.headline).toBe('Customer link expired');
    expect(expired.detail).toContain('Create a new link');
  });
  it('keeps future active links usable and mismatched-revision links unusable',()=>{
    const live=link(0,0,'active','2999-01-01T00:00:00Z');
    expect(quoteHandoffStatus(quote('Sent'),live,false).linkUsable).toBe(true);
    const old=quoteHandoffStatus(quote('Sent',1),live,false);
    expect(old.linkUsable).toBe(false);
    expect(old.linkExpired).toBe(false);
  });
  it('does not expire an already signed customer receipt',()=>{
    const signed=quoteHandoffStatus(quote('Signed'),link(0,1,'signed','2020-01-01T00:00:00Z'),false);
    expect(signed.linkUsable).toBe(true);
    expect(signed.linkExpired).toBe(false);
    expect(signed.signed).toBe(true);
  });
  it('a revoked link never becomes usable even with a future expiry',()=>{
    const revoked=quoteHandoffStatus(quote('Sent'),link(0,0,'revoked','2999-01-01T00:00:00Z'),false);
    expect(revoked.linkUsable).toBe(false);
    expect(revoked.linkRevoked).toBe(true);
  });
  it('retains signed status even without manual delivery confirmation',()=>{
    const signed=quoteHandoffStatus(quote('Signed'),link(0,5,'signed'),false);
    expect(signed.signed).toBe(true);
    expect(signed.deliveryConfirmed).toBe(false);
    expect(signed.headline).toBe('Signed by customer');
  });
});
