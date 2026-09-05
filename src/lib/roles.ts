/**
 * Role model. Three tiers, one portal.
 *  agency_admin       Isaac + Mitchell. Master view. Everything.
 *  enterprise_admin   An organization that carries several brands. Sees its brands, not the agency tools.
 *  enterprise_member  A seat inside an enterprise org. Works content for the org's brands.
 *  client             A single brand. Their content, their queue, AERA.
 */
export type Role = "agency_admin" | "enterprise_admin" | "enterprise_member" | "client";

export type NavKey = "dashboard" | "clients" | "onboard" | "content" | "brand" | "queue" | "aera";

export const NAV_ALL: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "clients",   label: "Clients",   href: "/clients" },
  { key: "onboard",   label: "Onboard",   href: "/onboard" },
  { key: "content",   label: "Content",   href: "/content" },
  { key: "brand",     label: "My Brand",  href: "/brand" },
  { key: "queue",     label: "Queue",     href: "/approvals" },
  { key: "aera",      label: "AERA",      href: "/chat" },
];

const ALLOWED: Record<Role, NavKey[]> = {
  agency_admin:      ["dashboard", "clients", "onboard", "content", "queue", "aera"],
  enterprise_admin:  ["dashboard", "clients", "content", "queue", "aera"],
  enterprise_member: ["content", "brand", "queue", "aera"],
  client:            ["content", "brand", "queue", "aera"],
};

export function navFor(role: Role | null | undefined) {
  const keys = ALLOWED[(role ?? "client") as Role] ?? ALLOWED.client;
  return NAV_ALL.filter((n) => keys.includes(n.key));
}

/** Home route for a role after sign in. */
export function homeFor(role: Role | null | undefined): string {
  return role === "agency_admin" || role === "enterprise_admin" ? "/dashboard" : "/content";
}

/** Routes that stay open to every signed-in user regardless of tier. */
const SHARED_PREFIXES = ["/account", "/chat", "/content", "/approvals"];

export function canVisit(role: Role | null | undefined, pathname: string): boolean {
  if (SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return navFor(role).some((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
}
