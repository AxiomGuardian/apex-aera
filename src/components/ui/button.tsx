"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-200 cursor-pointer select-none focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none";

    const variants = {
      primary:
        "bg-[var(--text)] text-[var(--bg)] hover:opacity-88 active:scale-[0.99]",
      secondary:
        "bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--text-2)] hover:border-[var(--border-mid)] active:scale-[0.99]",
      ghost:
        "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-[var(--hover-fill-cyan)] active:scale-[0.99]",
      outline:
        "border border-[var(--border)] text-[var(--text-4)] hover:border-[var(--border-mid)] hover:text-[var(--text-2)] hover:bg-[var(--hover-fill-cyan)] active:scale-[0.99]",
    };

    const sizes = {
      sm:   "h-7 px-3 text-[12px]",
      md:   "h-9 px-4 text-[13px]",
      lg:   "h-11 px-6 text-[14px]",
      icon: "h-8 w-8 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {children}
          </>
        ) : children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
