"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useAERA } from "@/context/AERAContext";
import {
  LayoutDashboard,
  Wand2,
  Rocket,
  FolderOpen,
  MessageSquare,
  Sparkles,
  UserCircle,
  LogOut,
  Settings,
  ChevronDown,
  Bot,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",         href: "/dashboard",  icon: LayoutDashboard },
  { label: "AERA Intelligence", href: "/chat",        icon: Wand2           },
  { label: "Agents",            href: "/agents",      icon: Bot             },
  { label: "Campaigns",         href: "/campaigns",   icon: Rocket          },
  { label: "Deliverables",      href: "/history",     icon: FolderOpen      },
];

export function TopNav() {
  const pathname = usePathname();
  const { isOpen, togglePanel } = useAERA();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const userName = session?.user?.name ?? "Client";
  const userEmail = session?.user?.email ?? "";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header
      className="relative z-30 w-full border-b"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--nav-border)",
      }}
    >
      <div className="flex items-center h-[80px] px-8 relative">

        {/* Logo */}
        <div className="flex items-center gap-3.5 shrink-0 z-10">
          <svg viewBox="0 0 28 28" fill="none" className="h-[26px] w-[26px]">
            <path d="M14 3L26 24H2L14 3Z" stroke="var(--text)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
            <path d="M8.5 18H19.5"        stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M14 10L18.5 18"      stroke="var(--text)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
            <path d="M14 10L9.5 18"       stroke="var(--text)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
            <circle cx="14" cy="3" r="1.4" fill="#2DD4FF" />
            <circle cx="14" cy="3" r="3.5" fill="#2DD4FF" opacity="0.12" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--text)" }}>
              APEX
            </span>
            <span className="text-[8.5px] tracking-[0.20em] uppercase mt-[3px]" style={{ color: "var(--text-5)" }}>
              AERA Client
            </span>
          </div>
        </div>

        {/* ── Centered nav ── */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex flex-col items-center gap-[7px] px-5 py-3 rounded-[12px]",
                  "transition-all duration-300 ease-out cursor-pointer select-none",
                  "hover:scale-[1.10]",
                  active ? "scale-[1.04]" : ""
                )}
              >
                {/* Ambient fill */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-[12px] transition-all duration-300",
                    active ? "opacity-[0.07]" : "opacity-0 group-hover:opacity-[0.045]"
                  )}
                  style={{ background: "var(--text)" }}
                />

                {/* Bloom glow */}
                <div
                  className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%]",
                    "h-10 w-10 rounded-full blur-2xl transition-all duration-500 ease-out",
                    active
                      ? "opacity-[0.10] scale-125"
                      : "opacity-0 scale-100 group-hover:opacity-[0.10] group-hover:scale-150"
                  )}
                  style={{ background: "var(--text)" }}
                />

                {/* Icon */}
                <div className="relative z-10 transition-all duration-300">
                  <Icon
                    className="h-[20px] w-[20px] transition-all duration-300"
                    style={{
                      color: active ? "var(--text)" : "var(--icon-rest)",
                      filter: active ? "drop-shadow(0 0 7px color-mix(in srgb, var(--text) 50%, transparent))" : "none",
                    }}
                    strokeWidth={active ? 2 : 1.65}
                  />
                </div>

                {/* Label */}
                <span
                  className="relative z-10 text-[11px] font-semibold tracking-[0.025em] transition-all duration-300 whitespace-nowrap"
                  style={{ color: active ? "var(--text)" : "var(--text-4)" }}
                >
                  {item.label}
                </span>

                {/* Active indicator */}
                {active && (
                  <span
                    className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[2.5px] w-5 rounded-full bg-[#2DD4FF]"
                    style={{ boxShadow: "0 0 8px rgba(45,212,255,0.65)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side — AERA toggle + theme + client pill */}
        <div className="ml-auto flex items-center gap-2.5 shrink-0 z-10">
          {/* AERA panel toggle */}
          <button
            onClick={togglePanel}
            title={isOpen ? "Close AERA" : "Open AERA"}
            className="group relative flex items-center gap-2.5 px-4 rounded-[10px] border transition-all duration-200"
            style={{
              height: 38,
              borderColor: isOpen ? "var(--cyan-border)" : "var(--border)",
              background: isOpen ? "var(--cyan-subtle)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isOpen) {
                e.currentTarget.style.borderColor = "rgba(45,212,255,0.20)";
                e.currentTarget.style.background = "rgba(45,212,255,0.04)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isOpen) {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <Sparkles
              className="h-4 w-4 transition-all duration-200"
              style={{
                color: isOpen ? "var(--cyan)" : "var(--text-5)",
                filter: isOpen ? "drop-shadow(0 0 5px rgba(45,212,255,0.7))" : "none",
              }}
              strokeWidth={1.7}
            />
            <span
              className="text-[13px] font-semibold tracking-[0.02em]"
              style={{ color: isOpen ? "var(--cyan)" : "var(--text-3)" }}
            >
              AERA
            </span>
            {/* live dot */}
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: isOpen ? "var(--cyan)" : "#505050",
                boxShadow: isOpen ? "0 0 6px rgba(45,212,255,0.85)" : "none",
                transition: "all 0.2s",
              }}
            />
          </button>

          <ThemeToggle />

          {/* User dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-3 px-4 rounded-[10px] border cursor-pointer transition-colors duration-200"
              style={{
                height: 38,
                borderColor: menuOpen ? "rgba(45,212,255,0.25)" : "var(--border)",
                background: menuOpen ? "rgba(45,212,255,0.04)" : "transparent",
              }}
              onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.borderColor = "var(--border-mid)"; }}
              onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-mid)" }}
              >
                <span className="text-[9px] font-bold" style={{ color: "var(--text-4)" }}>{initials}</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{userName}</span>
                <span className="text-[9px] mt-0.5" style={{ color: "var(--text-5)" }}>APEX Premium</span>
              </div>
              <div className="h-2 w-2 rounded-full bg-[#2DD4FF]" style={{ boxShadow: "0 0 6px rgba(45,212,255,0.60)" }} />
              <ChevronDown className="h-3 w-3 ml-0.5 transition-transform duration-200" style={{ color: "var(--text-5)", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-[14px] overflow-hidden z-50"
                style={{
                  background: "rgba(10,10,10,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
              >
                {/* User info header */}
                <div className="px-4 py-3.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{userName}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{userEmail}</p>
                </div>

                {/* Menu items */}
                <div className="p-1.5">
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] transition-all duration-150 group"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Settings className="h-4 w-4" strokeWidth={1.6} />
                    <span className="text-[13px]">Account Settings</span>
                  </Link>

                  <div className="my-1.5 mx-2 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

                  <button
                    onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[9px] transition-all duration-150"
                    style={{ color: "rgba(255,100,100,0.8)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,60,60,0.07)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.6} />
                    <span className="text-[13px]">Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom hairline — very subtle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 5%, var(--border) 30%, var(--border) 70%, transparent 95%)" }}
      />
    </header>
  );
}
