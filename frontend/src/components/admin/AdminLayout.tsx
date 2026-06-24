import { Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AdminNav } from "./AdminNav";

export function AdminLayout() {
  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-border-subtle bg-surface-raised px-3 py-6">
        <div className="flex items-center gap-2 px-3 mb-6">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Ops Console</p>
            <p className="text-[11px] text-text-muted">Admin</p>
          </div>
        </div>
        <AdminNav />
      </aside>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="md:hidden border-b border-border-subtle bg-surface-raised px-4 py-3 overflow-x-auto">
          <AdminNav horizontal />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
