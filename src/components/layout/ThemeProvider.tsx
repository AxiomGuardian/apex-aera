"use client";

// ThemeProvider — applies the saved theme on mount and exposes the toggle.
// Uses a CSS class (.light) on <html> rather than next-themes to avoid
// React 19 script-tag rendering conflicts.
//
// Light mode belongs to the portal only. The marketing site, the login and
// signup screens, the intro and the welcome-back screen are always dark, so
// the class is applied on portal routes and stripped everywhere else. The
// preference itself is kept, so signing back in restores light mode.

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "aera_theme_v1";

type Theme = "dark" | "light";

type ThemeCtx = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

// Routes inside the portal shell. Everything else stays dark.
const PORTAL = [
  "/dashboard",
  "/clients",
  "/brand",
  "/content",
  "/approvals",
  "/account",
  "/agents",
  "/campaigns",
  "/chat",
  "/conference",
  "/history",
  "/integrations",
  "/onboard",
];

export function isPortalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PORTAL.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const pathname = usePathname();

  // On mount: read the saved preference (do not paint yet, the effect below does)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    setTheme(saved === "light" ? "light" : "dark");
  }, []);

  // Paint on every theme or route change. Light only inside the portal.
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light" && isPortalPath(pathname));
  }, [theme, pathname]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
