export const COLLECTOR_PERMISSIONS = [
  "collector.profile.create",
  "collector.profile.edit_own",
  "collector.profile.view_private_own",
  "collector.card.create",
  "collector.card.edit_own",
  "collector.card.delete_own",
  "collector.card.publish_grade_own",
  "collector.trade.create",
  "collector.trade.manage_own",
  "collector.message.send",
  "collector.message.report",
  "collector.user.block",
  "collector.admin.view_profiles",
  "collector.admin.view_cards",
  "collector.admin.view_reports",
  "collector.admin.manage_reports",
  "collector.admin.open_moderation_case",
  "collector.admin.view_reported_conversations",
  "collector.admin.join_conversations",
  "collector.admin.send_moderator_messages",
  "collector.admin.restrict_messaging",
  "collector.admin.restrict_trading",
  "collector.admin.hide_profiles",
  "collector.admin.suspend_profiles",
  "collector.admin.suspend_users",
  "collector.admin.manage_settings",
  "collector.admin.view_audit",
] as const;

export type CollectorPermission = (typeof COLLECTOR_PERMISSIONS)[number];

export function hasCollectorPermission(
  granted: string[] | null | undefined,
  required: CollectorPermission,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return Boolean(granted?.includes(required));
}
