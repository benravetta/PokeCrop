import { create } from "zustand";
import {
  apiFetch,
  clearCsrfToken,
  exchangeHashSession,
  setCsrfToken,
} from "../lib/sessionFetch";

export interface SessionUser {
  id: string;
  email: string | null;
  role: "user" | "admin";
  displayName: string | null;
}

interface AuthState {
  user: SessionUser | null;
  /** Alias for user — kept for existing components. */
  session: SessionUser | null;
  initializing: boolean;
  recovering: boolean;

  init: () => Promise<void>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
    captchaToken?: string
  ) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearRecovering: () => void;
}

async function loadSession(): Promise<SessionUser | null> {
  const res = await apiFetch("/api/auth/session");
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: SessionUser | null };
  return data.user ?? null;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  initializing: true,
  recovering: false,

  init: async () => {
    try {
      const fromHash = await exchangeHashSession();
      if (fromHash) {
        set({ recovering: window.location.pathname === "/reset-password" });
      }
      const user = await loadSession();
      set({ user, session: user, initializing: false });
    } catch {
      set({ user: null, session: null, initializing: false });
    }
  },

  signIn: async (email, password, captchaToken) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captchaToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Could not sign in.");
    }
    const data = (await res.json()) as { user: SessionUser; csrfToken?: string };
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    set({ user: data.user, session: data.user });
  },

  signUp: async (email, password, displayName, captchaToken) => {
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, captchaToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Could not register.");
    }
    const data = (await res.json()) as {
      user: SessionUser | null;
      needsConfirmation?: boolean;
      csrfToken?: string;
    };
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    if (data.user) set({ user: data.user, session: data.user });
    return { needsConfirmation: Boolean(data.needsConfirmation) };
  },

  signOut: async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    clearCsrfToken();
    set({ user: null, session: null, recovering: false });
  },

  sendPasswordReset: async (email, captchaToken) => {
    const res = await apiFetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, captchaToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Could not send reset email.");
    }
  },

  updatePassword: async (password) => {
    const res = await apiFetch("/api/auth/password-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Could not update password.");
    }
    set({ recovering: false });
    const user = await loadSession();
    if (user) set({ user, session: user });
  },

  clearRecovering: () => set({ recovering: false }),
}));
