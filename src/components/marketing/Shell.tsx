"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/engines", label: "Engines" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/platform", label: "Platform" },
];

export function ApexMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" width={size} height={size} aria-hidden>
      <path
        d="M14 3L26 24H2L14 3Z"
        stroke="rgba(45,212,255,0.9)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{ background: "rgba(10,11,14,0.8)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent 5%, rgba(45,212,255,0.55) 50%, transparent 95%)" }} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <ApexMark />
          <span className="font-semibold tracking-[0.18em] text-sm" style={{ color: "var(--text, #e8e8e8)" }}>
            APEX&nbsp;AERA
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={"mkt-tab" + (pathname === t.href ? " mkt-tab-active" : "")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="mkt-btn text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 rounded-full shrink-0"
          style={{
            background: "linear-gradient(180deg, rgba(45,212,255,0.95), rgba(24,160,200,0.95))",
            color: "#04131a",
            boxShadow: "0 6px 24px rgba(45,212,255,0.22)",
          }}
        >
          Sign in
        </Link>
      </div>
      <nav className="md:hidden mkt-noscroll flex items-center gap-5 px-4 pb-2.5 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={"mkt-tab whitespace-nowrap" + (pathname === t.href ? " mkt-tab-active" : "")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function PageHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <section className="relative overflow-hidden mkt-grid">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 50% 0%, rgba(45,212,255,0.10) 0%, transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6 pt-14 sm:pt-20 pb-10 sm:pb-14 text-center">
        <p
          className="mkt-reveal inline-block text-[11px] tracking-[0.28em] uppercase mb-5 px-4 py-1.5 rounded-full"
          style={{ color: "#7fd9f7", border: "1px solid rgba(45,212,255,0.25)", background: "rgba(45,212,255,0.06)" }}
        >
          {kicker}
        </p>
        <h1
          className="mkt-reveal font-extrabold tracking-tight text-3xl sm:text-5xl"
          style={{ color: "var(--text, #ececec)", animationDelay: "0.08s" }}
        >
          {title}
        </h1>
        {sub && (
          <p
            className="mkt-reveal mx-auto mt-5 max-w-2xl text-base leading-relaxed"
            style={{ color: "var(--text-4, #9a9a9a)", animationDelay: "0.16s" }}
          >
            {sub}
          </p>
        )}
      </div>
    </section>
  );
}

export function CtaBand({ title, sub, cta }: { title: string; sub: string; cta: string }) {
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-6 pb-16 sm:pb-24">
      <div
        className="mkt-card mkt-line-cyan rounded-3xl px-6 py-11 sm:px-8 sm:py-14 text-center"
        style={{ background: "linear-gradient(180deg, rgba(45,212,255,0.07), rgba(18,20,24,0.7))" }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
          {title}
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
          {sub}
        </p>
        <Link
          href="/login"
          className="mkt-btn mt-8 inline-block text-sm font-semibold px-8 py-3 rounded-full"
          style={{
            background: "linear-gradient(180deg, rgba(45,212,255,0.95), rgba(24,160,200,0.95))",
            color: "#04131a",
            boxShadow: "0 8px 32px rgba(45,212,255,0.25)",
          }}
        >
          {cta}
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5">
          <ApexMark size={16} />
          <span className="text-xs tracking-[0.18em]" style={{ color: "var(--text-5, #6e6e6e)" }}>
            APEX AERA
          </span>
        </div>
        <nav className="flex items-center gap-5 flex-wrap justify-center">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-xs transition-colors hover:text-white"
              style={{ color: "var(--text-5, #6e6e6e)" }}
            >
              {t.label}
            </Link>
          ))}
          <Link href="/login" className="text-xs font-semibold" style={{ color: "#7fd9f7" }}>
            Sign in
          </Link>
        </nav>
        <p className="text-xs" style={{ color: "var(--text-6, #4e4e4e)" }}>
          © 2026 APEX AERA. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
