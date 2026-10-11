import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { appAbsoluteUrl } from '../lib/appUrl';
import { ensureCurrentWorkspace, hydrateCloudDocuments, startCloudSync, stopCloudSync } from '../services/cloudSync';
import { clearPendingTeamInvite, pendingTeamInviteToken } from '../services/teamInvitationLink';
import { maySeedCompanyFromLocal, type TeamRole } from '../services/teamAccess';
import type { TeamDepartment } from '../services/teamDepartments';
import { inviteAccountDecision, previewTeamInvite, type TeamInvitePreview } from '../services/teamInvitePreview';

export type BackendMode = 'local' | 'cloud';
export type InviteProblem = 'switch-account' | 'unavailable' | 'preview-error' | 'verify-email';
export type JoinWelcome = { userId: string; organizationId: string; organizationName: string; role: 'member' | 'admin' | 'viewer' };

interface AuthState {
  mode: BackendMode;
  ready: boolean;
  busy: boolean;
  user: User | null;
  session: Session | null;
  organizationId: string | null;
  /** A product-level identity, never a role in organization_members. */
  platformRole: 'developer' | null;
  teamRole: TeamRole | null;
  teamDepartment: TeamDepartment;
  passwordRecovery: boolean;
  inviteProblem: InviteProblem | null;
  activeInvitePreview: TeamInvitePreview | null;
  joinWelcome: JoinWelcome | null;
  dismissJoinWelcome: () => void;
  error: string | null;
  notice: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, shopName: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearMessage: () => void;
  retryWorkspace: () => Promise<void>;
  discardInvitation: () => Promise<void>;
}

let initializePromise: Promise<void> | null = null;
let authListenerStarted = false;
let inviteAcceptance: Promise<string> | null = null;
let activeSessionApplication: Promise<void> | null = null;
let activeSessionUserId: string | null = null;
const JOIN_WELCOME_KEY = 'salesshop-joined-team-welcome-v1';

function readJoinWelcome(userId: string, organizationId: string): JoinWelcome | null {
  try {
    const raw = sessionStorage.getItem(JOIN_WELCOME_KEY);
    const saved = raw ? JSON.parse(raw) as JoinWelcome : null;
    return saved?.userId === userId && saved.organizationId === organizationId ? saved : null;
  } catch { return null; }
}
function saveJoinWelcome(welcome: JoinWelcome) {
  try { sessionStorage.setItem(JOIN_WELCOME_KEY, JSON.stringify(welcome)); } catch { /* no storage */ }
}
function clearJoinWelcome() {
  try { sessionStorage.removeItem(JOIN_WELCOME_KEY); } catch { /* no storage */ }
}

function initialPasswordRecovery() {
  if (typeof window === 'undefined') return false;
  return /(?:[?#&])type=recovery(?:[&#]|$)/.test(window.location.search + window.location.hash);
}

async function acceptPendingInvitation(): Promise<string | null> {
  // Supabase refresh and getSession may overlap: await the same acceptance.
  if (inviteAcceptance) return inviteAcceptance;
  const token = pendingTeamInviteToken();
  if (!token || !supabase) return null;
  if (!inviteAcceptance) inviteAcceptance = (async () => {
    const { data, error } = await supabase.rpc('accept_team_invite', { invite_token: token });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Invitation acceptance did not return a workspace.');
    clearPendingTeamInvite();
    return data;
  })().finally(() => { inviteAcceptance = null; });
  return inviteAcceptance;
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Something went wrong.';
}

function reloadForIdentityBoundary() {
  if (typeof window !== 'undefined') window.location.reload();
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function applySession(session: Session | null): Promise<void> {
  // SIGNED_IN, INITIAL_SESSION and getSession can arrive together. Do not
  // race the one-use invitation RPC or hydrate one account twice.
  const userId = session?.user.id ?? null;
  if (activeSessionApplication && activeSessionUserId === userId) return activeSessionApplication;
  activeSessionUserId = userId;
  const running = performSessionApplication(session);
  activeSessionApplication = running;
  try { await running; }
  finally {
    if (activeSessionApplication === running) {
      activeSessionApplication = null;
      activeSessionUserId = null;
    }
  }
}

async function performSessionApplication(session: Session | null) {
  stopCloudSync();

  if (!session) {
    useAuthStore.setState({
      mode: supabaseConfigured ? 'cloud' : 'local',
      ready: true,
      busy: false,
      user: null,
      session: null,
      organizationId: null,
      platformRole: null,
      teamRole: null,
      teamDepartment: 'general',
      inviteProblem: null,
      activeInvitePreview: null,
      joinWelcome: null,
    });
    return;
  }

  useAuthStore.setState({ busy: true, ready: false, user: session.user, session,
    organizationId: null, platformRole: null, teamRole: null, teamDepartment: 'general', inviteProblem: null, activeInvitePreview: null, error: null, notice: null });
  try {
    // Consult only a boolean, JWT-scoped RPC before any tenant workspace
    // selection, creation, local hydration, or cloud sync.
    if (!supabase) throw new Error('Cloud is unavailable.');
    const { data: isDeveloper, error: developerError } = await supabase.rpc('is_platform_developer');
    if (developerError) throw developerError;
    if (isDeveloper === true) {
      if (pendingTeamInviteToken()) {
        throw new Error('Developer accounts cannot join company workspaces. Open the invitation with a separate employee account.');
      }
      useAuthStore.setState({
        mode:'cloud', ready:true, busy:false, user:session.user, session,
        organizationId:null, platformRole:'developer', teamRole:null,
        teamDepartment:'general', inviteProblem:null, activeInvitePreview:null, joinWelcome:null,
      });
      return;
    }
    const inviteToken = pendingTeamInviteToken();
    const invitePreview = inviteToken ? await previewTeamInvite(inviteToken) : null;
    if (inviteToken) {
      const decision = inviteAccountDecision(invitePreview, true);
      if (decision !== 'continue') {
        useAuthStore.setState({ mode: 'cloud', ready: true, busy: false,
          user: session.user, session, organizationId: null, activeInvitePreview: invitePreview,
          inviteProblem: decision === 'switch-account' ? 'switch-account' : 'unavailable',
          error: null });
        return;
      }
    }
    // Join the invited organization BEFORE workspace bootstrap or data hydration.
    // Otherwise an invited account could seed and switch to an unrelated shop.
    const acceptedOrganizationId = await acceptPendingInvitation();
    const organizationId = await ensureCurrentWorkspace();
    if (acceptedOrganizationId && acceptedOrganizationId !== organizationId) {
      throw new Error('Invitation joined a different workspace than the one selected.');
    }
    // Only owners bootstrapping their own shop may import existing local sales data.
    // Joining members must never upload another device's CRM/quotes into the team.
    if (!supabase) throw new Error('Cloud is unavailable.');
    const { data: membership, error: memberError } = await supabase.from('organization_members')
      .select('role,job_function').eq('organization_id', organizationId).eq('user_id', session.user.id).single();
    if (memberError || !membership) throw memberError ?? new Error('No team access found.');
    await hydrateCloudDocuments(organizationId, session.user.id, {
      allowCompanySeed: maySeedCompanyFromLocal(membership.role as TeamRole, Boolean(acceptedOrganizationId)),
      allowNotebookSeed: !acceptedOrganizationId,
    });
    startCloudSync(organizationId, session.user.id, (error) => {
      useAuthStore.setState({ error: `Cloud sync: ${error}` });
    }, { readOnlyShared: membership.role === 'viewer' });
    if (acceptedOrganizationId && invitePreview) saveJoinWelcome({
      userId: session.user.id, organizationId, organizationName: invitePreview.organizationName,
      role: invitePreview.role,
    });
    useAuthStore.setState({
      mode: 'cloud',
      ready: true,
      busy: false,
      user: session.user,
      session,
      organizationId,
      platformRole: null,
      teamRole: membership.role as TeamRole,
      teamDepartment: (membership.job_function as TeamDepartment) || 'general',
      joinWelcome: readJoinWelcome(session.user.id, organizationId),
      inviteProblem: null,
      activeInvitePreview: null,
    });
  } catch (error) {
    useAuthStore.setState({
      mode: 'cloud',
      ready: true,
      busy: false,
      user: session.user,
      session,
      organizationId: null,
      platformRole: null,
      inviteProblem: pendingTeamInviteToken()
        ? /Confirm your email address before joining/i.test(messageFrom(error)) ? 'verify-email' : 'preview-error'
        : null,
      error: messageFrom(error),
    });
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  mode: supabaseConfigured ? 'cloud' : 'local',
  ready: !supabaseConfigured,
  busy: false,
  user: null,
  session: null,
  organizationId: null,
  platformRole: null,
  teamRole: null,
  teamDepartment: 'general',
  passwordRecovery: initialPasswordRecovery(),
  inviteProblem: null,
  activeInvitePreview: null,
  joinWelcome: null,
  dismissJoinWelcome: () => { clearJoinWelcome(); set({ joinWelcome: null }); },
  error: null,
  notice: null,

  initialize: async () => {
    if (!supabaseConfigured || !supabase) {
      set({ mode: 'local', ready: true, busy: false });
      return;
    }
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      set({ mode: 'cloud', ready: false, busy: true, error: null });
      if (!authListenerStarted) {
        authListenerStarted = true;
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') useAuthStore.setState({ passwordRecovery: true });
          void applySession(session);
        });
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        set({ ready: true, busy: false, error: error.message });
        return;
      }
      await applySession(data.session);
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },

  signIn: async (email, password) => {
    if (!supabase) return false;
    set({ busy: true, error: null, notice: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      set({ busy: false, error: error.message });
      return false;
    }
    await applySession(data.session);
    reloadForIdentityBoundary();
    return true;
  },

  signUp: async (email, password, shopName) => {
    if (!supabase) return false;
    set({ busy: true, error: null, notice: null });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: appAbsoluteUrl('/'),
        data: {
          shop_name: shopName.trim() || 'My Shop',
          shop_timezone: browserTimezone(),
        },
      },
    });
    if (error) {
      set({ busy: false, error: error.message });
      return false;
    }
    if (data.session) {
      await applySession(data.session);
      reloadForIdentityBoundary();
    } else {
      set({
        busy: false,
        ready: true,
        notice: 'Account created. Check your email to confirm your address, then sign in.',
      });
    }
    return true;
  },

  sendPasswordReset: async (email) => {
    if (!supabase) return false;
    set({ busy: true, error: null, notice: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appAbsoluteUrl('/'),
    });
    set({ busy: false, error: error?.message ?? null,
      notice: error ? null : 'If this address has an account, you will receive a password reset email shortly.' });
    return !error;
  },

  updatePassword: async (password) => {
    if (!supabase) return false;
    set({ busy: true, error: null, notice: null });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      set({ busy: false, error: error.message });
      return false;
    }
    await supabase.auth.signOut();
    set({ passwordRecovery: false, busy: false, user: null, session: null,
      organizationId: null, teamRole: null, teamDepartment: 'general', error: null, notice: 'Password updated. Sign in with your new password.' });
    return true;
  },

  signOut: async () => {
    stopCloudSync();
    clearJoinWelcome();
    if (supabase) await supabase.auth.signOut();
    set({
      mode: supabaseConfigured ? 'cloud' : 'local',
      ready: true,
      busy: false,
      user: null,
      session: null,
      organizationId: null,
      teamRole: null,
      teamDepartment: 'general',
      inviteProblem: null,
      activeInvitePreview: null,
      joinWelcome: null,
      error: null,
      notice: null,
    });
    reloadForIdentityBoundary();
  },

  clearMessage: () => set({ error: null, notice: null }),
  retryWorkspace: async () => { const session = useAuthStore.getState().session; if (session) await applySession(session); },
  discardInvitation: async () => {
    clearPendingTeamInvite();
    const session = useAuthStore.getState().session;
    if (session) await applySession(session);
    else reloadForIdentityBoundary();
  },
}));
