"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X, Sparkles,
  LayoutDashboard, BrainCircuit, Rocket, FolderOpen, MessageSquare,
} from "lucide-react";
import { useAERA } from "@/context/AERAContext";

const navItems = [
  { label: "Dashboard",         href: "/dashboard", icon: LayoutDashboard },
  { label: "AERA Intelligence", href: "/chat",       icon: BrainCircuit   },
  { label: "Campaigns",         href: "/campaigns",  icon: Rocket         },
  { label: "Deliverables",      href: "/history",    icon: FolderOpen     },
  { label: "Contact APEX",      href: "/contact",    icon: MessageSquare  },
];

export function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { isOpen: aeraOpen, togglePanel } = useAERA();

  const close = () => setDrawerOpen(false);

  return (
    <>
      {/* ── Top bar — mobile only ── */}
      <header
        className="md:hidden relative z-40 flex items-center justify-between px-5 shrink-0"
        style={{
          height: 60,
          background: "var(--nav-bg)",
          borderBottom: "1px solid var(--nav-border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 28" fill="none" style={{ height: 22, width: 22 }}>
            <path d="M14 3L26 24H2L14 3Z" stroke="var(--text)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            <path d="M8.5 18H19.5"        stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 10L18.5 18"      stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M14 10L9.5 18"       stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: "var(--text)" }}>APEX</span>
            <span className="text-[7.5px] tracking-[0.22em] uppercase mt-0.5" style={{ color: "var(--text-6)" }}>AERA Client</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* AERA toggle */}
          <button
            onClick={togglePanel}
            className="flex items-center gap-1.5 px-2.5 h-8 rounded-[8px] border transition-all duration-200"
            style={{
              borderColor: aeraOpen ? "var(--cyan-border)" : "var(--border)",
              background: aeraOpen ? "var(--cyan-subtle)" : "transparent",
            }}
          >
            <Sparkles
              style={{
                width: 13, height: 13,
                color: aeraOpen ? "var(--cyan)" : "var(--text-5)",
                filter: aeraOpen ? "drop-shadow(0 0 4px rgba(45,212,255,0.6))" : "none",
              }}
              strokeWidth={1.7}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: aeraOpen ? "var(--cyan)" : "var(--text-4)" }}
            >
              AERA
            </span>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: aeraOpen ? "var(--cyan)" : "#404040",
                boxShadow: aeraOpen ? "0 0 5px rgba(45,212,255,0.8)" : "none",
                transition: "all 0.2s",
              }}
            />
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-[8px] border transition-all duration-200"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--text-4)",
            }}
          >
            <Menu style={{ width: 16, height: 16 }} strokeWidth={1.7} />
          </button>
        </div>

        {/* Bottom cyan hairline */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.08), transparent)" }}
        />
      </header>

      {/* ── Drawer + Backdrop ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={close}
              className="md:hidden fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
            />

            {/* Drawer */}
            <motion.nav
              key="drawer-panel"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 flex flex-col"
              style={{
                width: 280,
                background: "var(--surface)",
                borderRight: "1px solid var(--border-mid)",
                boxShadow: "4px 0 40px rgba(0,0,0,0.5)",
              }}
            >
              {/* Top cyan accent */}
              <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0, height: 1,
                background: "linear-gradient(90deg, rgba(45,212,255,0.4), transparent)",
              }} />

              {/* Drawer header */}
              <div
                className="flex items-center justify-between px-5 shrink-0"
                style={{
                  height: 60,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <svg viewBox="0 0 28 28" fill="none" style={{ height: 20, width: 20 }}>
                    <path d="M14 3L26 24H2L14 3Z" stroke="var(--text)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                    <path d="M8.5 18H19.5"        stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M14 10L18.5 18"      stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M14 10L9.5 18"       stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: "var(--text)" }}>
                    APEX
                  </span>
                </div>
                <button
                  onClick={close}
                  className="h-8 w-8 flex items-center justify-center rounded-[8px] border transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-5)",
                    background: "transparent",
                  }}
                >
                  <X style={{ width: 14, height: 14 }} strokeWidth={1.7} />
                </button>
              </div>

              {/* Nav section label */}
              <div className="px-5 pt-5 pb-2">
                <p style={{
                  fontSize: 9.5, fontWeight: 600,
                  letterSpacing: "0.14em", textTransform: "uppercase" as const,
                  color: "var(--text-6)",
                }}>
                  Navigation
                </p>
              </div>

              {/* Nav items */}
              <div className="flex flex-col px-3 gap-0.5 flex-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-3 px-3 py-3 rounded-[10px] transition-all duration-200"
                      style={{
                        background: active ? "rgba(45,212,255,0.06)" : "transparent",
                        border: `1px solid ${active ? "rgba(45,212,255,0.12)" : "transparent"}`,
                      }}
                    >
                      {/* Active indicator dot */}
                      <div style={{
                        width: 3, height: 20,
                        borderRadius: 2,
                        background: active ? "var(--cyan)" : "transparent",
                        boxShadow: active ? "0 0 6px rgba(45,212,255,0.5)" : "none",
                        flexShrink: 0,
                        transition: "all 0.2s",
                      }} />

                      <div
                        className="flex items-center justify-center rounded-[8px]"
                        style={{
                          width: 32, height: 32, flexShrink: 0,
                          background: active ? "rgba(45,212,255,0.08)" : "var(--surface-2)",
                          border: `1px solid ${active ? "rgba(45,212,255,0.18)" : "var(--border)"}`,
                          transition: "all 0.2s",
                        }}
                      >
                        <Icon
                          style={{
                            width: 14, height: 14,
                            color: active ? "var(--cyan)" : "var(--text-5)",
                            transition: "color 0.2s",
                          }}
                          strokeWidth={active ? 2 : 1.6}
                        />
                      </div>

                      <span
                        style={{
                          fontSize: 13, fontWeight: active ? 500 : 400,
                          color: active ? "var(--text-2)" : "var(--text-4)",
                          letterSpacing: "-0.01em",
                          transition: "color 0.2s",
                        }}
                      >
                        {item.label}
                      </span>

                      {active && (
                        <span
                          className="ml-auto"
                          style={{
                            width: 6, height: 6,
                            borderRadius: "50%",
                            background: "var(--cyan)",
                            boxShadow: "0 0 5px rgba(45,212,255,0.6)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Footer — client profile */}
              <div
                className="mx-3 mb-4 mt-4 p-3 rounded-[12px] flex items-center gap-3"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: 36, height: 36,
                    background: "var(--surface-3)",
                    border: "1px solid var(--border-mid)",
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-4)", letterSpacing: "0.02em" }}>CL</span>
                </div>
                <div className="flex flex-col leading-none flex-1 min-w-0">
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>Client</span>
                  <span style={{ fontSize: 9.5, color: "var(--text-5)", marginTop: 3 }}>APEX Premium</span>
                </div>
                <div
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "#2DD4FF", boxShadow: "0 0 5px rgba(45,212,255,0.55)" }}
                />
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
