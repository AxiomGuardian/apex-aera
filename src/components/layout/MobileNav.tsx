"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BrainCircuit, Rocket, FolderOpen, MessageSquare, UserCircle } from "lucide-react";

const navItems = [
  { label: "Home",    href: "/dashboard", icon: LayoutDashboard },
  { label: "AERA",    href: "/chat",       icon: BrainCircuit   },
  { label: "Work",    href: "/campaigns",  icon: Rocket         },
  { label: "Files",   href: "/history",    icon: FolderOpen     },
  { label: "Contact", href: "/contact",    icon: MessageSquare  },
  { label: "Account", href: "/account",    icon: UserCircle     },
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
