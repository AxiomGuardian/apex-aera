/**
 * PagePad — Standard padded scrollable container for dashboard pages.
 * Wraps page content in the responsive padding that was previously
 * in (dashboard)/layout.tsx. Use this in every non-full-height page.
 */
export function PagePad({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      style={{ background: "var(--bg)" }}
    >
      <div className="px-4 py-5 sm:px-6 sm:py-8 md:px-10 md:py-10 max-w-[1180px] mx-auto pb-24 md:pb-10">
        {children}
      </div>
    </div>
  );
}
