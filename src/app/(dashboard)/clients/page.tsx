"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { Loader2, Plus, Building2 } from "lucide-react";

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  content_assets: { count: number }[];
  brand_members: { count: number }[];
};

export default function ClientsPage() {
  const router = useRouter();
  const [brands,  setBrands]  = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("brands")
      .select("id,name,slug,status,created_at,content_assets(count),brand_members(count)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setBrands((data ?? []) as unknown as BrandRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <PagePad>
      <div className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="label-eyebrow mb-2.5">Book of Business</p>
            <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>
              Clients
            </h2>
          </div>
          <button
            onClick={() => router.push("/onboard")}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "rgba(45,212,255,0.12)", border: "1px solid rgba(45,212,255,0.28)", color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Plus style={{ width: 13, height: 13 }} strokeWidth={2} />
            Onboard client
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "var(--text-5)", margin: "0 auto" }} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((b, i) => (
              <div
                key={b.id}
                onClick={() => router.push(`/clients/${b.id}`)}
                className="opacity-0 animate-fade-in-up"
                style={{
                  animationDelay: `${0.05 + i * 0.06}s`, animationFillMode: "forwards",
                  padding: "24px 24px 20px", borderRadius: 18, cursor: "pointer",
                  background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(45,212,255,0.25)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Building2 style={{ width: 17, height: 17, color: "var(--text-4)" }} strokeWidth={1.5} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 3 }}>Since {new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>
                    <span style={{ color: "var(--text-2)", fontWeight: 700 }}>{b.content_assets?.[0]?.count ?? 0}</span> assets
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>
                    <span style={{ color: "var(--text-2)", fontWeight: 700 }}>{b.brand_members?.[0]?.count ?? 0}</span> members
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: b.status === "active" ? "#34D399" : "var(--text-5)", background: b.status === "active" ? "rgba(52,211,153,0.08)" : "var(--surface-2)", border: `1px solid ${b.status === "active" ? "rgba(52,211,153,0.2)" : "var(--border)"}` }}>
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PagePad>
  );
}
