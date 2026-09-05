import Link from "next/link";
import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative px-5 py-16 sm:px-8 sm:py-24", className)}>
      <div className="mx-auto w-full max-w-[1120px]">{children}</div>
    </section>
  );
}

export function Overline({ children }: { children: React.ReactNode }) {
  return <p className="kit-overline">{children}</p>;
}

export function KitButton({
  href,
  variant = "gold",
  children,
  className,
  type = "button",
  disabled,
}: {
  href?: string;
  variant?: "gold" | "ghost";
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls = cn(
    "kit-btn",
    variant === "gold" && "kit-btn-gold",
    variant === "ghost" && "kit-btn-ghost",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function StatusChip({ children }: { children: React.ReactNode }) {
  return <span className="kit-chip">{children}</span>;
}

export function Card({
  children,
  className,
  href,
  staticHover = false,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  staticHover?: boolean;
}) {
  const cls = cn("kit-card block p-6 sm:p-7", staticHover && "kit-card-static", className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}
