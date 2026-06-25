import type { HumanPregradeStatus } from "./types.js";

const ALLOWED: Record<HumanPregradeStatus, HumanPregradeStatus[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["awaiting_submission", "submitted", "cancelled"],
  awaiting_submission: ["submitted", "cancelled"],
  submitted: ["queued", "cancelled"],
  queued: ["assigned", "cancelled"],
  assigned: ["under_review", "cancelled"],
  under_review: [
    "awaiting_customer_images",
    "report_drafting",
    "unable_to_assess",
    "cancelled",
  ],
  awaiting_customer_images: ["customer_images_received", "unable_to_assess", "cancelled"],
  customer_images_received: ["under_review", "cancelled"],
  report_drafting: ["quality_check", "cancelled"],
  quality_check: ["completed", "under_review", "cancelled"],
  completed: [],
  unable_to_assess: ["refunded", "cancelled"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransition(from: HumanPregradeStatus, to: HumanPregradeStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: HumanPregradeStatus, to: HumanPregradeStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition ${from} → ${to}`);
  }
}

export const CUSTOMER_PROGRESS_STEPS = [
  {
    id: 1,
    label: "Payment",
    statuses: ["awaiting_payment", "paid", "awaiting_submission"] as HumanPregradeStatus[],
  },
  { id: 2, label: "Submitted", statuses: ["submitted"] as HumanPregradeStatus[] },
  { id: 3, label: "Queued", statuses: ["queued", "assigned"] as HumanPregradeStatus[] },
  {
    id: 4,
    label: "Under review",
    statuses: ["under_review", "customer_images_received"] as HumanPregradeStatus[],
  },
  {
    id: 5,
    label: "More images needed",
    statuses: ["awaiting_customer_images"] as HumanPregradeStatus[],
  },
  {
    id: 6,
    label: "Report preparation",
    statuses: ["report_drafting", "quality_check"] as HumanPregradeStatus[],
  },
  { id: 7, label: "Complete", statuses: ["completed"] as HumanPregradeStatus[] },
] as const;

export const TERMINAL_CUSTOMER_STATUSES: HumanPregradeStatus[] = [
  "cancelled",
  "refunded",
  "unable_to_assess",
];

export type CustomerProgress = {
  step: number;
  totalSteps: number;
  label: string;
  percentComplete: number;
  isBranch: boolean;
  branchStep: number | null;
  isTerminal: boolean;
  terminalStatus: HumanPregradeStatus | null;
};

export const CUSTOMER_STATUS_LABELS: Record<HumanPregradeStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  paid: "Payment received",
  awaiting_submission: "Waiting for submission",
  submitted: "Submitted",
  queued: "Waiting for an expert",
  assigned: "Assigned to an expert",
  under_review: "Under expert review",
  awaiting_customer_images: "More images needed",
  customer_images_received: "New images received",
  report_drafting: "Report being prepared",
  quality_check: "Final quality check",
  completed: "Report ready",
  unable_to_assess: "Unable to assess",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function resolveCustomerProgress(status: HumanPregradeStatus): CustomerProgress {
  const totalSteps = CUSTOMER_PROGRESS_STEPS.length;

  if (TERMINAL_CUSTOMER_STATUSES.includes(status)) {
    return {
      step: 0,
      totalSteps,
      label: CUSTOMER_STATUS_LABELS[status],
      percentComplete: 0,
      isBranch: false,
      branchStep: null,
      isTerminal: true,
      terminalStatus: status,
    };
  }

  if (status === "draft") {
    return {
      step: 0,
      totalSteps,
      label: "Draft",
      percentComplete: 0,
      isBranch: false,
      branchStep: null,
      isTerminal: false,
      terminalStatus: null,
    };
  }

  if (status === "awaiting_customer_images") {
    return {
      step: 5,
      totalSteps,
      label: CUSTOMER_PROGRESS_STEPS[4]!.label,
      percentComplete: Math.round((4 / totalSteps) * 100),
      isBranch: true,
      branchStep: 5,
      isTerminal: false,
      terminalStatus: null,
    };
  }

  for (let i = 0; i < CUSTOMER_PROGRESS_STEPS.length; i++) {
    const def = CUSTOMER_PROGRESS_STEPS[i]!;
    if (def.statuses.includes(status)) {
      const completed = status === "completed" ? totalSteps : i + 1;
      const percentComplete =
        status === "completed" ? 100 : Math.round(((i + 0.5) / totalSteps) * 100);
      return {
        step: completed,
        totalSteps,
        label: def.label,
        percentComplete,
        isBranch: false,
        branchStep: null,
        isTerminal: false,
        terminalStatus: null,
      };
    }
  }

  return {
    step: 1,
    totalSteps,
    label: CUSTOMER_STATUS_LABELS[status],
    percentComplete: 5,
    isBranch: false,
    branchStep: null,
    isTerminal: false,
    terminalStatus: null,
  };
}
