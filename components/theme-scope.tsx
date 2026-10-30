"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";

// Lets Base UI's portal-based popups (Select, Dialog, DropdownMenu, AlertDialog) render
// inside the .theme-classical scope instead of their default target (document.body),
// so a popup opened from a marketing/auth page inherits the Classical CSS variables
// instead of showing the blue/Geist admin look (review finding M-1). Absent (null)
// outside that scope — e.g. everywhere under (app) — so those popups keep their
// current body-portal behavior unchanged.
const ThemeScopeContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useThemeScopeContainer(): RefObject<HTMLElement | null> | null {
  return useContext(ThemeScopeContext);
}

/** Wraps a scoped theme root (e.g. .theme-classical) and publishes a ref to it via
 * context, so descendant popups can portal into it instead of document.body. */
export function ThemeScopeProvider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={className}>
      <ThemeScopeContext.Provider value={ref}>{children}</ThemeScopeContext.Provider>
    </div>
  );
}
