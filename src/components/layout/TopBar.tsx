"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":  { title: "Dashboard",         subtitle: "Intelligence overview"      },
  "/chat":       { title: "AERA Intelligence",  subtitle: "Your AI brand companion"   },
  "/campaigns":  { title: "Campaigns",          subtitle: "Active work & pipelines"   },
  "/history":    { title: "Deliverables",       subtitle: "History & completed assets" },
  "/contact":    { title: "Contact APEX",       subtitle: "Your dedicated team"       },
};

export function TopBar() {
  const pathname = usePathname();

  const matchedKey = Object.keys(pageMeta).find(
    (k) => pathname === k || pathname.startsWith(k + "/")
  );
  const meta = matchedKey
    ? pageMeta[matchedKey]
    : { title: "AERA", subtitle: "Client Dashboard" };

  return (
    <header className="h-[68px] flex items-center gap-6 px-8 bg-[#0a0a0a] border-b border-[rgba(255,255,255,0.07)] shrink-0">
      {/* Page title */}
      <div className="flex flex-col leading-none">
        <h1 className="text-[15px] font-semibold text-white tracking-[-0.02em]">
          {meta.title}
        </h1>
        <p className="text-[11px] text-[#525252] mt-0.5 font-normal">{meta.subtitle}</p>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search className="absolute left-3 h-3.5 w-3.5 text-[#404040]" strokeWidth={1.6} />
        <input
          type="text"
          placeholder="Search..."
          className="h-8 w-52 pl-8 pr-4 text-[12.5px] bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-[8px] text-[#d4d4d4] placeholder:text-[#404040] focus:outline-none focus:border-[rgba(255,255,255,0.18)] transition-all"
        />
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-[11px] text-[#525252]">
        <div className="h-1.5 w-1.5 rounded-full bg-[#404040]" />
        <span>System active</span>
      </div>
    </header>
  );
}
