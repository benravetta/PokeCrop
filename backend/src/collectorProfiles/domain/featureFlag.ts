export function isCollectorProfilesEnvEnabled(): boolean {
  return (
    process.env.COLLECTOR_PROFILES_ENABLED === "1" ||
    process.env.COLLECTOR_PROFILES_ENABLED === "true"
  );
}

export function usernameRedirectDaysFromEnv(): number {
  const raw = parseInt(process.env.COLLECTOR_PROFILE_USERNAME_REDIRECT_DAYS || "90", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
}
