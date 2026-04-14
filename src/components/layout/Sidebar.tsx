"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BrainCircuit,
  Rocket,
  FolderOpen,
  MessageSquare,
  UserCircle,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",         href: "/dashboard", icon: LayoutDashboard },
  { label: "AERA Intelligence", href: "/chat",       icon: BrainCircuit   },
  { label: "Campaigns",         href: "/campaigns",  icon: Rocket         },
  { label: "Deliverables",      href: "/history",    icon: FolderOpen     },
  { label: "Contact APEX",      href: "/contact",    icon: MessageSquare  },
  { label: "Account",           href: "/account",    icon: UserCircle     },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-[240px] shrink-0 h-screen bg-[#0a0a0a] border-r border-[rgba(255,255,255,0.07)]">

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-[68px] border-b border-[rgba(255,255,255,0.07)] shrink-0">
        {/* Geometric A mark — pure white, mirrors logo shape */}
        <div className="relative h-7 w-7 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7">
            {/* Outer triangle */}
            <path
              d="M14 3L26 24H2L14 3Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Inner crossbar */}
            <path
              d="M8.5 18H19.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Inner peak */}
            <path
              d="M14 10L18.5 18"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M14 10L9.5 18"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-bold tracking-[0.12em] text-white uppercase">
            APEX
          </span>
          <span className="text-[9px] tracking-[0.2em] text-[#525252] uppercase font-medium mt-0.5">
            AERA Client
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-[9px] transition-all duration-150 relative",
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-[#525252] hover:text-[#d4d4d4] hover:bg-white/[0.04]"
              )}
            >
              {/* Active dot */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-white" />
              )}

              <Icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-colors",
                  active ? "text-white" : "text-[#404040] group-hover:text-[#737373]"
                )}
                strokeWidth={active ? 2 : 1.7}
              />

              <span
                className={cn(
                  "text-[13px] tracking-[-0.01em]",
                  active ? "font-medium" : "font-normal"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 pt-3 border-t border-[rgba(255,255,255,0.07)] shrink-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="h-7 w-7 rounded-full bg-[#1c1c1c] border border-[rgba(255,255,255,0.1)] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-[#d4d4d4]">CL</span>
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-[12px] font-medium text-white truncate">Client</span>
            <span className="text-[10px] text-[#525252] mt-0.5">APEX Premium</span>
          </div>
          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#404040]" />
        </div>
      </div>
    </aside>
  );
}
