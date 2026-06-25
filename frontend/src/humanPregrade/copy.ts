export const CUSTOMER_PROGRESS_STEPS = [
  { id: 1, label: "Payment", statuses: ["awaiting_payment", "paid", "awaiting_submission"] },
  { id: 2, label: "Submitted", statuses: ["submitted"] },
  { id: 3, label: "Queued", statuses: ["queued", "assigned"] },
  { id: 4, label: "Under review", statuses: ["under_review", "customer_images_received"] },
  { id: 5, label: "More images needed", statuses: ["awaiting_customer_images"] },
  { id: 6, label: "Report preparation", statuses: ["report_drafting", "quality_check"] },
  { id: 7, label: "Complete", statuses: ["completed"] },
] as const;

const TERMINAL = ["cancelled", "refunded", "unable_to_assess"];

const LABELS: Record<string, string> = {
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

export type CustomerProgress = {
  step: number;
  totalSteps: number;
  label: string;
  percentComplete: number;
  isBranch: boolean;
  branchStep: number | null;
  isTerminal: boolean;
  terminalStatus: string | null;
};

export function resolveCustomerProgress(status: string): CustomerProgress {
  const totalSteps = CUSTOMER_PROGRESS_STEPS.length;
  if (TERMINAL.includes(status)) {
    return {
      step: 0,
      totalSteps,
      label: LABELS[status] ?? status,
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
    if (def.statuses.some((s) => s === status)) {
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
    label: LABELS[status] ?? status,
    percentComplete: 5,
    isBranch: false,
    branchStep: null,
    isTerminal: false,
    terminalStatus: null,
  };
}

export function customerStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function evidenceBadge(isDirect: boolean) {
  return isDirect ? "Directly verified" : "Archived sale record";
}
