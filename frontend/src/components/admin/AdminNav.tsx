import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PoundSterling,
  Activity,
  Wrench,
  Layers,
} from "lucide-react";

const LINKS = [
  { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/revenue", label: "Revenue", icon: PoundSterling },
  { to: "/admin/usage", label: "Usage", icon: Activity },
  { to: "/admin/operations", label: "Operations", icon: Wrench },
  { to: "/admin/catalog", label: "Catalog", icon: Layers },
] as const;

export function AdminNav({ horizontal }: { horizontal?: boolean }) {
  return (
    <nav className={`flex ${horizontal ? "flex-row gap-1 min-w-max" : "flex-col gap-0.5"}`}>
      {LINKS.map(({ to, label, icon: Icon, ...rest }) => (
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
