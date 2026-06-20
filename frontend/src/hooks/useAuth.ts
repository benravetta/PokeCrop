import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  /** Set when a password-recovery link has been opened (drives the reset flow). */
  recovering: boolean;

  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearRecovering: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  initializing: true,
  recovering: false,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        initializing: false,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      set({
        session,
        user: session?.user ?? null,
        initializing: false,
        ...(event === "PASSWORD_RECOVERY" ? { recovering: true } : {}),
      });
    });

    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });
    if (error) throw error;
    // When email confirmation is enabled, signUp returns a user but no session.
    const needsConfirmation = !data.session;
    return { needsConfirmation };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, recovering: false });
  },

  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    set({ recovering: false });
  },

  clearRecovering: () => set({ recovering: false }),
}));
