"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KIT_NAV } from "@/lib/kit/constants";
import { KitLogo } from "@/components/kit/Logo";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function KitNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="kit-nav">
      <div className="mx-auto flex h-16 w-full min-w-0 max-w-[1120px] items-center justify-between px-5 sm:h-[4.25rem] sm:px-8">
        <KitLogo size="nav" />

        <nav className="kit-desktop-nav" aria-label="Primary">
          {KIT_NAV.map((item) => {
            const current = isActive(pathname, item.href, "exact" in item && item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="kit-nav-link"
                aria-current={current ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="kit-btn kit-menu-toggle"
          aria-expanded={open}
          aria-controls="kit-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden className="flex w-5 flex-col gap-[5px]">
            <span
              className="block h-px bg-[#D4AF37] transition-transform duration-300"
              style={{ transform: open ? "translateY(6px) rotate(45deg)" : undefined }}
            />
            <span
              className="block h-px bg-[#D4AF37] transition-opacity duration-300"
              style={{ opacity: open ? 0 : 1 }}
            />
            <span
              className="block h-px bg-[#D4AF37] transition-transform duration-300"
              style={{ transform: open ? "translateY(-6px) rotate(-45deg)" : undefined }}
            />
          </span>
        </button>
      </div>

      {open ? (
        <nav
          id="kit-mobile-nav"
          className="kit-mobile-panel px-5 py-4 lg:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-1">
            {KIT_NAV.map((item) => {
              const current = isActive(pathname, item.href, "exact" in item && item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="kit-nav-link block rounded-lg px-3 py-3"
                    aria-current={current ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
