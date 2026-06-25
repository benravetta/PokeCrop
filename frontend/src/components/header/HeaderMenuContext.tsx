import { createContext, useContext, type ReactNode } from "react";

const HeaderMenuContext = createContext<(() => void) | undefined>(undefined);

export function HeaderMenuProvider({
  closeMenu,
  children,
}: {
  closeMenu: () => void;
  children: ReactNode;
}) {
  return (
    <HeaderMenuContext.Provider value={closeMenu}>{children}</HeaderMenuContext.Provider>
  );
}

/** Close the mobile nav sheet after in-menu navigation. No-op outside an open menu. */
export function useCloseHeaderMenu() {
  return useContext(HeaderMenuContext);
}
