export const HUMAN_PREGRADE_PERMISSIONS = [
  "human_pregrade.customer.create",
  "human_pregrade.customer.view_own",
  "human_pregrade.reviewer.view_assigned",
  "human_pregrade.reviewer.edit_assigned",
  "human_pregrade.reviewer.request_images",
  "human_pregrade.reviewer.submit",
  "human_pregrade.qa.view",
  "human_pregrade.qa.approve",
  "human_pregrade.qa.return",
  "human_pregrade.admin.view_all",
  "human_pregrade.admin.assign",
  "human_pregrade.admin.reassign",
  "human_pregrade.admin.configure",
  "human_pregrade.admin.refund",
  "human_pregrade.admin.audit",
] as const;

export type HumanPregradePermission = (typeof HUMAN_PREGRADE_PERMISSIONS)[number];

export const ALL_HUMAN_PREGRADE_PERMISSIONS: HumanPregradePermission[] = [
  ...HUMAN_PREGRADE_PERMISSIONS,
];

export const REVIEWER_DEFAULT: HumanPregradePermission[] = [
  "human_pregrade.reviewer.view_assigned",
  "human_pregrade.reviewer.edit_assigned",
  "human_pregrade.reviewer.request_images",
  "human_pregrade.reviewer.submit",
];

export const QA_DEFAULT: HumanPregradePermission[] = [
  "human_pregrade.qa.view",
  "human_pregrade.qa.approve",
  "human_pregrade.qa.return",
  ...REVIEWER_DEFAULT,
];

export function hasHumanPregradePermission(
  granted: string[] | null | undefined,
  required: HumanPregradePermission,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return Boolean(granted?.includes(required));
}
