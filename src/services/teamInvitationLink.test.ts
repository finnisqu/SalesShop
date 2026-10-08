import { describe, expect, it } from 'vitest';
import {
  capturePendingTeamInvite, clearPendingTeamInvite,
  pendingTeamInviteToken, teamInviteUrl,
} from './teamInvitationLink';

const token = 'ab'.repeat(32);
function fakeWindow() {
  const session = new Map<string,string>();
  const local = new Map<string,string>();
  const makeStorage = (map:Map<string,string>) => ({
    getItem:(key:string)=>map.get(key) ?? null,
    setItem:(key:string,value:string)=>{map.set(key,value);},
    removeItem:(key:string)=>{map.delete(key);},
  });
  const location = { href:'https://preview.netlify.app/',hash:`#invite=${token}`,pathname:'/',search:'' };
  const browser = {
    sessionStorage:makeStorage(session),
    localStorage:makeStorage(local),
    location,
    history:{state:null,replaceState:(_state:unknown,_title:string,_url:string)=>{location.hash='';}},
  };
  return {browser,session,local};
}

describe('team invitation handoff', () => {
  it('rejects invalid invitation token shapes and uses canonical SalesShop URL', () => {
    expect(() => teamInviteUrl('not-a-token')).toThrow('Invalid invitation token');
    expect(() => teamInviteUrl('a'.repeat(63))).toThrow('Invalid invitation token');
  });

  it('preserves an invite across confirmation tabs, then removes both copies when accepted', () => {
    const originalWindow = (globalThis as {window?:unknown}).window;
    const {browser,session,local}=fakeWindow();
    Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
    try {
      capturePendingTeamInvite();
      expect(browser.location.hash).toBe('');
      expect(pendingTeamInviteToken()).toBe(token);
      expect(session.size).toBe(1);
      expect(local.size).toBe(1);
      session.clear(); // Email confirmation opened in another browser tab.
      expect(pendingTeamInviteToken()).toBe(token);
      expect(teamInviteUrl(token)).toBe(`https://app.salesshop.work/#invite=${token}`);
      clearPendingTeamInvite();
      expect(pendingTeamInviteToken()).toBeNull();
      expect(local.size).toBe(0);
    } finally {
      if (originalWindow===undefined) Reflect.deleteProperty(globalThis,'window');
      else Object.defineProperty(globalThis,'window',{configurable:true,value:originalWindow});
    }
  });

  it('rejects expired handoffs before accessing the team', () => {
    const originalWindow=(globalThis as {window?:unknown}).window;
    const {browser,local}=fakeWindow();
    browser.location.hash='';
    local.set('salesshop-invite-handoff-v1',
      JSON.stringify({token,expiresAt:Date.now()-1000}));
    Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
    try {
      expect(pendingTeamInviteToken()).toBeNull();
      expect(local.size).toBe(0);
    } finally {
      if (originalWindow===undefined) Reflect.deleteProperty(globalThis,'window');
      else Object.defineProperty(globalThis,'window',{configurable:true,value:originalWindow});
    }
  });
});
