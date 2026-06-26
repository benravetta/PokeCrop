/** Return a generic auth error to clients; log provider detail server-side only. */
export function safeAuthError(
  context: string,
  providerMessage: string | undefined,
  fallback: string
): string {
  if (providerMessage) {
    console.warn(`[auth] ${context}: ${providerMessage}`);
  }
  return fallback;
}
