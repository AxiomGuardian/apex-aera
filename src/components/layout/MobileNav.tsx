"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wand2, Rocket, FolderOpen, MessageSquare } from "lucide-react";

const navItems = [
  { label: "Dashboard",    href: "/dashboard", icon: LayoutDashboard },
  { label: "AERA",         href: "/chat",      icon: Wand2           },
  { label: "Campaigns",    href: "/campaigns", icon: Rocket          },
  { label: "Deliverables", href: "/history",   icon: FolderOpen      },
  { label: "Contact",      href: "/contact",   icon: MessageSquare   },
];

export function MobileNav() {
  const pathname = usePathname();
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
