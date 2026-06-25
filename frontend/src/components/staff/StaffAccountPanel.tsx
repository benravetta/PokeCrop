import { STAFF_ACCOUNT } from "../../lib/staffAccount";

/** Account page copy for staff accounts — single muted block, no badges. */
export function StaffAccountPanel() {
  return (
    <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
      <p>{STAFF_ACCOUNT.accountBody}</p>
      <p className="text-[12px] text-text-muted">{STAFF_ACCOUNT.accountNote}</p>
    </div>
  );
}
