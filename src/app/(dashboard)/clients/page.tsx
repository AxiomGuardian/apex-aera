"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { Loader2, Plus, Building2 } from "lucide-react";
import { useSession } from "@/components/layout/SessionProvider";

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
  const { data: session } = useSession();
  const role = session?.user?.role ?? null;
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");

  async function addBrand(e: React.FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setAddErr("");
    try {
      const res = await fetch("/api/enterprise/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const j = (await res.json()) as { ok?: boolean; brand?: { id: string }; error?: string };
      if (!res.ok || !j.ok || !j.brand) throw new Error(j.error ?? "Could not add brand");
      router.push("/clients/" + j.brand.id);
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : "Could not add brand");
      setAddBusy(false);
    }
  }

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
            <p className="label-eyebrow mb-2.5">{role === "enterprise_admin" ? "Your Organization" : "Book of Business"}</p>
            <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>
              {role === "enterprise_admin" ? "Brands" : "Clients"}
            </h2>
          </div>
          {role === "enterprise_admin" ? (
            <button
              onClick={() => setAdding((a) => !a)}
              className="mkt-btn dash-btn"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "rgba(45,212,255,0.12)", border: "1px solid rgba(45,212,255,0.28)", color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Plus style={{ width: 13, height: 13 }} strokeWidth={2} />
              Add brand
            </button>
          ) : role === "agency_admin" ? (
            <button
              onClick={() => router.push("/onboard")}
              className="mkt-btn dash-btn"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "rgba(45,212,255,0.12)", border: "1px solid rgba(45,212,255,0.28)", color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Plus style={{ width: 13, height: 13 }} strokeWidth={2} />
              Onboard client
            </button>
          ) : null}
        </div>

        {adding && role === "enterprise_admin" && (
          <form onSubmit={addBrand} className="mkt-card mkt-quiet" style={{ display: "flex", gap: 10, alignItems: "center", padding: "16px 18px", maxWidth: 560 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New brand name" required className="auth-input" style={{ padding: "11px 13px", fontSize: 13 }} />
            <button type="submit" disabled={addBusy} className="mkt-btn dash-btn" style={{ padding: "11px 16px", borderRadius: 10, background: "rgba(45,212,255,0.12)", border: "1px solid rgba(45,212,255,0.28)", color: "var(--cyan)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {addBusy ? "Creating" : "Create"}
            </button>
            {addErr && <span style={{ fontSize: 11.5, color: "#fb7185" }}>{addErr}</span>}
          </form>
        )}

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
                className="mkt-card mkt-line-cyan opacity-0 animate-fade-in-up"
                style={{
                  animationDelay: `${0.05 + i * 0.06}s`, animationFillMode: "forwards",
                  padding: "24px 24px 20px", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div className="dash-chip">
                    <Building2 style={{ width: 17, height: 17, color: "var(--cyan)" }} strokeWidth={1.5} />
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
