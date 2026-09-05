"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { BrandWorkspace } from "@/components/brand/BrandWorkspace";

/** My Brand: the signed-in person's own workspace settings, connections, and intelligence. */
export default function MyBrandPage() {
  const [brandId, setBrandId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setBrandId(null); return; }
      const { data } = await supabase
        .from("brand_members")
        .select("brand_id")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setBrandId(data?.brand_id ?? null);
    })();
  }, []);

  if (brandId === undefined) {
    return (
      <PagePad>
        <div style={{ padding: 80, textAlign: "center" }}>
          <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "var(--text-5)", margin: "0 auto" }} />
        </div>
      </PagePad>
    );
  }
  if (brandId === null) {
    return (
      <PagePad>
        <div className="mkt-card mkt-quiet" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-3)" }}>No brand is attached to your account yet.</p>
          <p style={{ fontSize: 12, color: "var(--text-6)", marginTop: 6 }}>Ask your APEX contact to add you to a workspace.</p>
        </div>
      </PagePad>
    );
  }
  return <BrandWorkspace brandId={brandId} mode="client" />;
}
