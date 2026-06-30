import { Link, type LinkProps } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  guestPrimaryCtaLabel,
  guestSignupPath,
  type ToolIntent,
  useInviteRequired,
} from "../../hooks/useInviteRequired";

type Props = Omit<LinkProps, "to"> & {
  registerLabel?: string;
  waitlistLabel?: string;
  showArrow?: boolean;
  intent?: ToolIntent;
};

/** Guest signup CTA — `/register` or waitlist when invite-only. */
export function GuestPrimaryCtaLink({
  children,
  registerLabel = "Check a card free",
  waitlistLabel,
  showArrow = false,
  intent,
  className,
  ...props
}: Props) {
  const { inviteRequired } = useInviteRequired();
  const base = guestSignupPath(inviteRequired);
  const to = intent ? `${base}${base.includes("?") ? "&" : "?"}intent=${intent}` : base;
  const label =
    children ??
    (inviteRequired
      ? (waitlistLabel ?? guestPrimaryCtaLabel(true))
      : registerLabel);

  return (
    <Link
      to={to}
      className={showArrow ? `inline-flex items-center gap-2 ${className ?? ""}` : className}
      {...props}
    >
      {label}
      {showArrow ? <ArrowRight className="w-4 h-4 shrink-0" /> : null}
    </Link>
  );
}
