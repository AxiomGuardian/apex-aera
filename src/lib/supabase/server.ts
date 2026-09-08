import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * Server-side Supabase client. Next.js 16: cookies() is async — always await.
 * Also honours "Authorization: Bearer <access_token>" so the mobile app can
 * call the same API routes as the web portal with its Supabase session.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const auth = hdrs.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(bearer ? { global: { headers: { Authorization: "Bearer " + bearer } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
}
