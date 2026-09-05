"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/layout/SessionProvider";
import { canVisit, homeFor } from "@/lib/roles";

/**
 * Tier gate for the portal. If a signed-in user lands on a route their tier
 * does not include (a client opening /clients, for example), send them home.
 * The database enforces this too; this keeps the UI honest.
 */
export function RouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !data?.user) return;
    const role = data.user.role;
    if (role === null) return; // profile not loaded yet
    if (!canVisit(role, pathname)) router.replace(homeFor(role));
  }, [status, data, pathname, router]);

  return null;
}
