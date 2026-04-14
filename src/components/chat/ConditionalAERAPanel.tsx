"use client";

/**
 * ConditionalAERAPanel
 *
 * Renders the AERA side panel on all dashboard pages EXCEPT /chat,
 * which has its own full-page AERA interface. Showing the panel
 * there would duplicate the conversation and clutter the layout.
 */

import { usePathname } from "next/navigation";
import { AERAPanel } from "./AERAPanel";

export function ConditionalAERAPanel() {
  const pathname = usePathname();

  // The full AERA chat page has its own complete interface.
  // The floating panel would duplicate conversation content there.
  if (pathname === "/chat") return null;

  return <AERAPanel />;
}
