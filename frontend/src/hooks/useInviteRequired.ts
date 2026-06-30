import { useEffect, useState } from "react";
import { getAuthConfig } from "../lib/api";
import { WAITLIST } from "../lib/marketingCopy";

export type ToolIntent = "grade" | "crop";

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export function fetchInviteRequired(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = getAuthConfig()
      .then((r) => {
        cached = r.inviteRequired;
        return cached;
      })
      .catch(() => {
        cached = false;
        return false;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function guestSignupPath(inviteRequired: boolean | null): string {
  return inviteRequired ? WAITLIST.path : "/register";
}

export function guestPrimaryCtaLabel(inviteRequired: boolean | null): string {
  return inviteRequired ? WAITLIST.joinLabel : "Check a card free";
}

export function intentTargetPath(intent: ToolIntent | null | undefined): string {
  return intent === "grade" ? "/grade" : "/crop";
}

export function guestIntentPath(
  inviteRequired: boolean | null,
  intent: ToolIntent
): string {
  const base = guestSignupPath(inviteRequired);
  const glue = base.includes("?") ? "&" : "?";
  return `${base}${glue}intent=${intent}`;
}

export function useInviteRequired(): {
  inviteRequired: boolean | null;
  loading: boolean;
} {
  const [inviteRequired, setInviteRequired] = useState<boolean | null>(cached);

  useEffect(() => {
    void fetchInviteRequired().then(setInviteRequired);
  }, []);

  return { inviteRequired, loading: inviteRequired === null };
}
