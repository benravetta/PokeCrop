import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useMe } from "../hooks/useMe";
import { useAuth } from "../hooks/useAuth";
import { AdminBadge, isAdminMe } from "../lib/adminAccess";

// Compact header indicator: shows remaining free crops, or an "Unlimited" pill
// for paying users. Links through to the account/billing page.
export function CropsBadge() {
  const { session } = useAuth();
  const { me, refresh } = useMe();

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  if (!me) return null;

  if (isAdminMe(me)) {
    return (
      <Link
        to="/account"
        className="inline-flex items-center"
        title="Admin account — full access"
      >
        <AdminBadge />
      </Link>
    );
  }

  if (me.plan !== "free") {
    return (
      <Link
        to="/account"
        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium
                   text-accent bg-accent/10 border border-accent/20 hover:bg-accent/15 transition-colors"
        title="Your plan"
      >
        <Sparkles className="w-3 h-3" />
        Unlimited
      </Link>
    );
  }

  const remaining = me.cropsRemaining ?? 0;
  const depleted = remaining <= 0;

  return (
    <Link
      to="/account"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
        depleted
          ? "text-error bg-error/10 border-error/20 hover:bg-error/15"
          : "text-text-secondary bg-surface-overlay border-border-subtle hover:text-text-primary"
      }`}
      title="Free daily crops remaining"
    >
      {remaining} left today
    </Link>
  );
}
