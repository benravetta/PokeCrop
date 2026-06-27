import { NavLink } from "react-router-dom";
import { appNavActive, appNavIdle, appNavLink } from "./styles";
import { useCollectorProfilesConfig } from "../../collectorProfiles/hooks/useCollectorProfilesConfig";

type AppNavLinksProps = {
  onNavigate?: () => void;
  /** Stack links vertically — used in the mobile menu sheet. */
  stacked?: boolean;
};

export function AppNavLinks({ onNavigate, stacked = false }: AppNavLinksProps) {
  const { enabled: collectorEnabled } = useCollectorProfilesConfig();
  return (
    <nav className={stacked ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
      <NavLink
        to="/crop"
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `${appNavLink} ${isActive ? appNavActive : appNavIdle}`
        }
      >
        Crop &amp; centring
      </NavLink>
      <NavLink
        to="/grade"
        onClick={onNavigate}
        className={({ isActive }) =>
          `${appNavLink} ${isActive ? appNavActive : appNavIdle}`
        }
      >
        Grade
      </NavLink>
      {collectorEnabled && (
        <NavLink
          to="/collector/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            `${appNavLink} ${isActive ? appNavActive : appNavIdle}`
          }
        >
          Collector profile
        </NavLink>
      )}
    </nav>
  );
}
