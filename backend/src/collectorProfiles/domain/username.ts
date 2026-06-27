import { PROFANITY_BLOCKLIST, RESERVED_USERNAMES } from "./reservedUsernames.js";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export type UsernameValidationResult =
  | { ok: true; username: string }
  | { ok: false; code: string; message: string };

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): UsernameValidationResult {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, code: "username_required", message: "Username is required." };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      code: "username_invalid",
      message: "Username must be 3–30 characters: lowercase letters, numbers and underscores only.",
    };
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, code: "username_reserved", message: "That username is not available." };
  }
  for (const word of PROFANITY_BLOCKLIST) {
    if (username.includes(word)) {
      return { ok: false, code: "username_profanity", message: "That username is not available." };
    }
  }
  return { ok: true, username };
}
