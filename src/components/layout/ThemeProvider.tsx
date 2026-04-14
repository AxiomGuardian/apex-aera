"use client";

// ThemeProvider — applies saved theme on mount and exposes toggle context.
// Uses a CSS class (.light) on <html> rather than next-themes to avoid
// React 19 script-tag rendering conflicts.

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

const STORAGE_KEY = "aera_theme_v1";

type Theme = "dark" | "light";

type ThemeCtx = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // On mount: read saved preference and apply
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
