import { useEffect, useState } from "react";

/** Matches the header mobile-sheet breakpoint (Tailwind `md`). */
const MOBILE_QUERY = "(max-width: 767px)";

function getMatch(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Reactive mobile-viewport flag driven by `matchMedia`. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
