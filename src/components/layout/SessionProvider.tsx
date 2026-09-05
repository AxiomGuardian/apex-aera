"use client";

/**
 * Supabase-backed session context.
 * Exposes useSession() and signOut() with the same shape the app used
 * under next-auth, so consumer components only change their import.
 */

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@/lib/roles";

type SessionData = {
  user: { id: string; name: string; email: string; image?: string | null; role: Role | null };
} | null;

const SessionContext = createContext<{
  data: SessionData;
  status: "loading" | "authenticated" | "unauthenticated";
}>({ data: null, status: "loading" });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SessionData>(null);
  const [status, setStatus] =
    useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const supabase = createClient();

    const sync = async (user: User | null) => {
      if (user) {
        const name =
          (user.user_metadata?.full_name as string) ||
          (user.email ? user.email.split("@")[0] : "User");
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        setData({
          user: {
            id: user.id,
            name,
            email: user.email ?? "",
            image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
            role: (prof?.role as Role | undefined) ?? null,
          },
        });
        setStatus("authenticated");
      } else {
        setData(null);
        setStatus("unauthenticated");
      }
    };

    supabase.auth.getUser().then(({ data: d }) => void sync(d.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void sync(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ data, status }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export async function signOut(opts?: { callbackUrl?: string; immediate?: boolean }) {
  // The curtain (SignOutCurtain) handles the fade and the real sign-out.
  if (!opts?.immediate && typeof window !== "undefined") {
    window.dispatchEvent(new Event("apex:signout"));
    return;
  }
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = opts?.callbackUrl ?? "/login";
}
