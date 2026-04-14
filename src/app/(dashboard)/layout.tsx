import { TopNav } from "@/components/layout/TopNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { AERAProvider } from "@/context/AERAContext";
import { ClientMemoryProvider } from "@/context/ClientMemory";
import { ConditionalAERAPanel } from "@/components/chat/ConditionalAERAPanel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMemoryProvider>
    <AERAProvider>
      <div
        className="flex flex-col h-screen w-full overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        {/* Desktop top nav */}
        <div className="hidden md:block shrink-0">
          <TopNav />
        </div>

        {/* Mobile top bar + drawer */}
        <MobileHeader />

        {/* Content row — main area + AERA side panel */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/*
            main is overflow-hidden + fixed height so full-page pages
            (like /chat) can fill it exactly with their own scroll.
            Pages that need natural scroll wrap their content in an
            overflow-y-auto container themselves (see PagePad component).
          */}
          <main
            className="flex-1 overflow-hidden min-w-0 min-h-0"
            style={{ background: "var(--bg)", display: "flex", flexDirection: "column" }}
          >
            {children}
          </main>

          {/* AERA panel slides in from the right (hidden on /chat — has its own full UI) */}
          <ConditionalAERAPanel />
        </div>

        {/* Mobile bottom tab bar */}
        <MobileNav />
      </div>
    </AERAProvider>
    </ClientMemoryProvider>
  );
}
