import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "cyan" | "success" | "muted";
  dot?: boolean;
}

function Badge({ className, variant = "default", dot, children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border-mid)]",
    cyan:    "bg-[rgba(45,212,255,0.1)] text-[#2DD4FF] border border-[rgba(45,212,255,0.2)]",
    success: "bg-[var(--surface-2)] text-[var(--text-4)] border border-[var(--border)]",
    muted:   "bg-transparent text-[var(--text-5)] border border-[var(--border)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-medium tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          variant === "cyan" ? "bg-[#2DD4FF]" : "bg-[var(--text-5)]"
        )} />
      )}
      {children}
    </span>
  );
}

export { Badge };
