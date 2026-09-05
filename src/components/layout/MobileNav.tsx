"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Plus, Upload, Wand2, CheckCircle2 } from "lucide-react";
import { useSession } from "@/components/layout/SessionProvider";
import { navFor } from "@/lib/roles";

const ICONS = { dashboard: LayoutDashboard, clients: Users, onboard: Plus, content: Upload, queue: CheckCircle2, aera: Wand2 } as const;

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const navItems = navFor(session?.user?.role ?? null).map((n) => ({ ...n, icon: ICONS[n.key] }));
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t pb-safe"
      style={{
        background: "var(--bg-deep)",
        borderColor: "var(--border)",
        boxShadow: "0 -1px 0 var(--border)",
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-colors"
          >
            <Icon
              className="h-5 w-5 transition-colors"
              style={{ color: active ? "var(--text)" : "var(--icon-rest)" }}
              strokeWidth={active ? 2 : 1.6}
            />
            <span
              className="text-[9px] tracking-wide font-medium"
              style={{ color: active ? "var(--text)" : "var(--text-6)" }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
