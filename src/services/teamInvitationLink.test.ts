import { describe, expect, it, vi } from 'vitest';
import { clearPendingTeamInvite, pendingTeamInviteToken, teamInviteUrl } from './teamInvitationLink';
const token = 'ab'.repeat(32);
describe('Team invite browser links', () => {
  it('requires an unpredictable fixed-length token', () => {
    expect(() => teamInviteUrl('not-a-token')).toThrow('Invalid invitation token');
    expect(() => teamInviteUrl('a'.repeat(63))).toThrow('Invalid invitation token');
  });
  it('holds tokens only in sessionStorage, not persistent localStorage', () => {
    const storage = new Map<string,string>();
    const originalWindow = (globalThis as {window?:unknown}).window;
    const windowMock = {
      sessionStorage: {
        getItem:(key:string)=>storage.get(key) ?? null,
        setItem:(key:string,value:string)=>{storage.set(key,value);},
        removeItem:(key:string)=>{storage.delete(key);},
      },
      location:{href:'https://example.org/SalesShop/',hash:'',pathname:'/SalesShop/',search:''},
    };
    Object.defineProperty(globalThis,'window',{configurable:true,value:windowMock});
    try {
      expect(pendingTeamInviteToken()).toBeNull();
      windowMock.sessionStorage.setItem('salesshop-pending-team-invite-v1',token);
      expect(pendingTeamInviteToken()).toBe(token);
      expect(teamInviteUrl(token)).toBe(`https://example.org/SalesShop/#invite=${token}`);
      clearPendingTeamInvite();
      expect(pendingTeamInviteToken()).toBeNull();
    } finally {
      if (originalWindow === undefined) Reflect.deleteProperty(globalThis,'window');
      else Object.defineProperty(globalThis,'window',{configurable:true,value:originalWindow});
      vi.restoreAllMocks();
    }
  });
});
