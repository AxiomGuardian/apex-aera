import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * APEX AERA auth guard — Supabase session refresh + route protection.
 * Public: / (front page), /login, /auth/*, /welcome, /access-denied.
 * Everything else requires a user.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser() — session refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isKitHost = host.includes("kingdominitiativetechnologies");

  if (isKitHost && !pathname.startsWith("/kit")) {
    const mapped = mapKitHostPath(pathname);
    if (mapped) {
      const url = request.nextUrl.clone();
      url.pathname = mapped;
      const rewrite = NextResponse.rewrite(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        rewrite.cookies.set(cookie.name, cookie.value);
      });
      return rewrite;
    }
  }

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/kit") ||
    pathname.startsWith("/engines") ||
    pathname.startsWith("/how-it-works") ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/request-access") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/access-denied") ||
    pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

function mapKitHostPath(pathname: string): string | null {
  if (pathname.startsWith("/kit")) return null;
  const stripped = pathname.replace(/\/$/, "") || "/";
  if (stripped === "/") return "/kit";
  const first = stripped.split("/")[1] ?? "";
  if (["wisdomwatch", "kcrm", "vision", "guardrails", "contact"].includes(first)) {
    return `/kit${stripped}`;
  }
  return null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
