import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocked=vi.hoisted(()=>({
 refresh:vi.fn(),status:vi.fn(),exchange:vi.fn(),revoke:vi.fn(),popup:vi.fn(),
}));
vi.mock('./gmailPersistent396',()=>({
 persistentStatus396:mocked.status,
 refreshPersistent396:mocked.refresh,
 exchangePersistent396:mocked.exchange,
 revokePersistent396:mocked.revoke,
 requestPersistentCode396:mocked.popup,
}));
import {useGmailSessionStore,validGmailToken} from '../store/gmailSession359a';

const scope='cloud:test-organization:test-user';
const ready=(extras:Record<string,unknown>={})=>{
 useGmailSessionStore.setState({
  scope,token:'live-gmail-token',mailbox:'person@builder.example',
  expiresAt:Date.now()+2*60_000,status:'connected',persistent:true,
  persistentConfigured:true,restoring:false,needsReconnect:false,
  loading:false,error:null,threads:[],...extras,
 });
};
beforeEach(()=>{
 vi.resetAllMocks();
 useGmailSessionStore.getState().bindScope(null);
 useGmailSessionStore.getState().bindScope(scope);
});
describe('#396 — Gmail restoration and renewal',()=>{
 it('uses a single refresh request when focus, timer and search overlap',async()=>{
  ready();
  let resolve!: (value:{token:string;mailbox:string;expiresAt:number})=>void;
  mocked.refresh.mockReturnValue(new Promise(res=>{resolve=res;}));
  const store=useGmailSessionStore.getState();
  const first=store.renewPersistent();
  const second=store.renewPersistent();
  const third=store.renewPersistent();
  expect(mocked.refresh).toHaveBeenCalledTimes(1);
  resolve({token:'renewed-gmail-token',mailbox:'person@builder.example',
   expiresAt:Date.now()+3600_000});
  await Promise.all([first,second,third]);
  expect(useGmailSessionStore.getState().token).toBe('renewed-gmail-token');
  expect(validGmailToken(scope)?.token).toBe('renewed-gmail-token');
 });
 it('does not discard an existing token on a transient refresh failure',async()=>{
  ready();
  mocked.refresh.mockRejectedValue(new Error('Gmail connection service unavailable. Retry later.'));
  await useGmailSessionStore.getState().renewPersistent();
  const state=useGmailSessionStore.getState();
  expect(state.token).toBe('live-gmail-token');
  expect(state.persistent).toBe(true);
  expect(state.needsReconnect).toBe(false);
  expect(state.error).toMatch(/unavailable/);
 });
 it('keeps the saved grant retryable when an expired token cannot be renewed',async()=>{
  ready({expiresAt:Date.now()-1});
  mocked.refresh.mockRejectedValue(new Error('Gmail service temporarily unavailable.'));
  await useGmailSessionStore.getState().search('newer_than:90d');
  const state=useGmailSessionStore.getState();
  expect(state.persistent).toBe(true);
  expect(state.persistentConfigured).toBe(true);
  expect(state.token).toBe('live-gmail-token');
  expect(state.threads).toEqual([]);
 });
 it('requires reconnection after a confirmed Google invalid grant',async()=>{
  ready();
  mocked.refresh.mockRejectedValue(new Error('Google authorization expired. Reconnect Gmail.'));
  await useGmailSessionStore.getState().renewPersistent();
  const state=useGmailSessionStore.getState();
  expect(state.needsReconnect).toBe(true);
  expect(state.persistentConfigured).toBe(true);
  expect(state.token).toBe(null);
  expect(validGmailToken(scope)).toBe(null);
 });
 it('does not treat a failed configuration check as a ready Worker',async()=>{
  useGmailSessionStore.setState({scope,token:null,persistent:false,
   persistentConfigured:false,status:'disconnected',restoring:false});
  mocked.status.mockRejectedValue(new Error('Worker unavailable'));
  await useGmailSessionStore.getState().restorePersistent();
  const state=useGmailSessionStore.getState();
  expect(state.persistentConfigured).toBe(false);
  expect(state.restoring).toBe(false);
 });
 it('rejects a delayed renewal after the account identity changes',async()=>{
  ready();
  let resolve!: (value:{token:string;mailbox:string;expiresAt:number})=>void;
  mocked.refresh.mockReturnValue(new Promise(res=>{resolve=res;}));
  const pending=useGmailSessionStore.getState().renewPersistent();
  useGmailSessionStore.getState().bindScope(null);
  useGmailSessionStore.getState().bindScope(scope);
  resolve({token:'old-user-access',mailbox:'other@builder.example',
   expiresAt:Date.now()+3600_000});
  await pending;
  expect(useGmailSessionStore.getState().token).toBe(null);
  expect(validGmailToken(scope)).toBe(null);
 });
});
