import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  PoundSterling,
  Activity,
  Wrench,
  Layers,
  UserCheck,
  UserCircle,
} from "lucide-react";
import { useHumanPregradeConfig } from "../../humanPregrade/hooks/useHumanPregradeConfig";

const BASE_LINKS = [
  { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/revenue", label: "Revenue", icon: PoundSterling },
  { to: "/admin/usage", label: "Usage", icon: Activity },
  { to: "/admin/operations", label: "Operations", icon: Wrench },
  { to: "/admin/catalog", label: "Catalogue", icon: Layers },
] as const;

type AdminNavLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export function AdminNav({ horizontal }: { horizontal?: boolean }) {
  const { enabled: hpEnabled } = useHumanPregradeConfig();
  const links: AdminNavLink[] = [...BASE_LINKS];
  if (hpEnabled) {
    links.push({ to: "/admin/human-pregrades", label: "Expert reviews", icon: UserCheck });
  }
  links.push({ to: "/admin/collector/settings", label: "Collector profiles", icon: UserCircle });

  return (
    <nav className={`flex ${horizontal ? "flex-row gap-1 min-w-max" : "flex-col gap-0.5"}`}>
      {links.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={"end" in rest ? rest.end : undefined}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
              isActive
                ? "bg-accent/15 text-accent font-medium"
                : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
