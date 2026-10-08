import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { ensureCurrentWorkspace, hydrateCloudDocuments, startCloudSync, stopCloudSync } from '../services/cloudSync';
import { clearPendingTeamInvite, pendingTeamInviteToken } from '../services/teamInvitationLink';
import { maySeedCompanyFromLocal, type TeamRole } from '../services/teamAccess';

export type BackendMode = 'local' | 'cloud';

interface AuthState {
  mode: BackendMode;
  ready: boolean;
  busy: boolean;
  user: User | null;
  session: Session | null;
  organizationId: string | null;
  error: string | null;
  notice: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, shopName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearMessage: () => void;
  retryWorkspace: () => Promise<void>;
  discardInvitation: () => Promise<void>;
}

let initializePromise: Promise<void> | null = null;
let authListenerStarted = false;
let inviteAcceptance: Promise<string> | null = null;

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
  return error instanceof Error ? error.message : 'Something went wrong.';
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

async function applySession(session: Session | null) {
  stopCloudSync();

  if (!session) {
    useAuthStore.setState({
      mode: supabaseConfigured ? 'cloud' : 'local',
      ready: true,
      busy: false,
      user: null,
      session: null,
      organizationId: null,
    });
    return;
  }

  useAuthStore.setState({ busy: true, error: null, notice: null });
  try {
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
      .select('role').eq('organization_id', organizationId).eq('user_id', session.user.id).single();
    if (memberError || !membership) throw memberError ?? new Error('No team access found.');
    await hydrateCloudDocuments(organizationId, session.user.id, {
      allowCompanySeed: maySeedCompanyFromLocal(membership.role as TeamRole, Boolean(acceptedOrganizationId)),
      allowNotebookSeed: !acceptedOrganizationId,
    });
    startCloudSync(organizationId, session.user.id, (error) => {
      useAuthStore.setState({ error: `Cloud sync: ${error}` });
    });
    useAuthStore.setState({
      mode: 'cloud',
      ready: true,
      busy: false,
      user: session.user,
      session,
      organizationId,
    });
  } catch (error) {
    useAuthStore.setState({
      mode: 'cloud',
      ready: true,
      busy: false,
      user: session.user,
      session,
      organizationId: null,
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
        supabase.auth.onAuthStateChange((_event, session) => {
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

  signOut: async () => {
    stopCloudSync();
    if (supabase) await supabase.auth.signOut();
    set({
      mode: supabaseConfigured ? 'cloud' : 'local',
      ready: true,
      busy: false,
      user: null,
      session: null,
      organizationId: null,
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
  },
}));
