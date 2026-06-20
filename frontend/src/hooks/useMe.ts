import { create } from "zustand";
import { fetchMe, type MeResponse } from "../lib/api";

interface MeState {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

// Account/plan/usage snapshot from the backend (/api/me). Refreshed on login and
// after each successful crop so the remaining-crops indicator stays accurate.
export const useMe = create<MeState>((set) => ({
  me: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const me = await fetchMe();
      set({ me, loading: false });
    } catch {
      // Endpoint may be unavailable (e.g. not signed in); fail quietly.
      set({ loading: false });
    }
  },
  clear: () => set({ me: null }),
}));
