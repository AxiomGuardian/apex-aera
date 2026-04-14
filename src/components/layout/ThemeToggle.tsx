"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="h-8 w-8 flex items-center justify-center rounded-[8px] border transition-all duration-200"
      style={{
        borderColor: "var(--border)",
        background: "transparent",
        color: "var(--text-5)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-mid)";
        e.currentTarget.style.color = "var(--text-3)";
        e.currentTarget.style.background = "var(--hover-fill)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text-5)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {isLight
        ? <Moon className="h-3.5 w-3.5" strokeWidth={1.7} />
        : <Sun  className="h-3.5 w-3.5" strokeWidth={1.7} />
      }
    </button>
  );
}
