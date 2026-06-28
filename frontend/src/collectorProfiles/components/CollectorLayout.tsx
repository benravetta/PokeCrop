import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { fetchMyCollectorProfile } from "../api";
import { CollectorNavMobile, CollectorNavSidebar } from "./CollectorNav";

export function CollectorLayout() {
  const location = useLocation();
  const isCentered = location.pathname.startsWith("/collector/setup");
  const [profileMeta, setProfileMeta] = useState<{
    username?: string;
    displayName?: string;
    status?: string;
  } | null>(null);

  useEffect(() => {
    if (isCentered) return;
    fetchMyCollectorProfile()
      .then((d) =>
        setProfileMeta({
          username: d.profile.username,
          displayName: d.profile.display_name,
          status: d.profile.status,
        })
      )
      .catch(() => setProfileMeta(null));
  }, [isCentered, location.pathname]);

  if (isCentered) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col page-x page-y sm:py-10">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl page-x page-y">
        <CollectorNavMobile />
        <div className="mt-5 lg:mt-0 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-10">
          <CollectorNavSidebar
            username={profileMeta?.username}
            displayName={profileMeta?.displayName}
            status={profileMeta?.status}
          />
          <main className="min-w-0 space-y-6 anim-rise">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
