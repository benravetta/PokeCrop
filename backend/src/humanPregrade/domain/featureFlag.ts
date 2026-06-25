export function isHumanPregradeEnvEnabled(): boolean {
  return process.env.HUMAN_PREGRADE_ENABLED === "1" || process.env.HUMAN_PREGRADE_ENABLED === "true";
}
