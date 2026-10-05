import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { ensureCurrentWorkspace, hydrateCloudDocuments, startCloudSync, stopCloudSync } from '../services/cloudSync';

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
}

let initializePromise: Promise<void> | null = null;
let authListenerStarted = false;

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function reloadForIdentityBoundary() {
  if (typeof window !== 'undefined') window.location.reload();
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
    const organizationId = await ensureCurrentWorkspace();
    await hydrateCloudDocuments(organizationId, session.user.id);
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
      options: { data: { shop_name: shopName.trim() || 'My Shop' } },
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
}));
