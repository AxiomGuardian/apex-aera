"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { PagePad } from "@/components/layout/PagePad";
import {
  User, Users, CreditCard, Shield, MonitorSmartphone,
  FileText, MessageCircle, ChevronRight, Check, AlertTriangle,
  Eye, EyeOff, Download, Trash2, Bell, Globe, Key,
  Camera, X,
} from "lucide-react";

/* ── Tab definitions ── */
const TABS = [
  { id: "profile",  label: "Profile",       icon: User       },
  { id: "team",     label: "Team",          icon: Users      },
  { id: "billing",  label: "Billing",       icon: CreditCard },
  { id: "privacy",  label: "Privacy",       icon: Shield     },
  { id: "security", label: "Security",      icon: Key        },
  { id: "support",  label: "Support",       icon: MessageCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ── Shared primitives ── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px 26px", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function SectionHead({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{label}</h3>
      {sub && <p style={{ fontSize: 12, color: "var(--text-5)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function FieldRow({ label, value, action, badge }: { label: string; value: string; action?: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <p style={{ fontSize: 11, color: "var(--text-5)", letterSpacing: "0.02em", marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{value}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {badge && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--cyan)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 20, background: "var(--cyan-subtle)", border: "1px solid var(--cyan-border)" }}>{badge}</span>}
        {action && <button style={{ fontSize: 11, color: "var(--text-5)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s", padding: "2px 6px", borderRadius: 5 }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-5)")}>{action}</button>}
      </div>
    </div>
  );
}

function Toggle({ label, description, defaultOn = false }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: "76%" }}>
        <p style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 3, lineHeight: 1.45 }}>{description}</p>
      </div>
      <button onClick={() => setOn(p => !p)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: on ? "var(--cyan)" : "var(--surface-3)", position: "relative", transition: "background 0.2s", flexShrink: 0, boxShadow: on ? "0 0 10px rgba(45,212,255,0.3)" : "none" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: on ? "#000" : "var(--text-6)", transition: "left 0.18s" }} />
      </button>
    </div>
  );
}

/* ── Profile tab ── */
function ProfileTab() {
  const { data: session } = useSession();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const userName  = session?.user?.name  ?? "APEX Client";
  const userEmail = session?.user?.email ?? "—";
  const googleAvatar = session?.user?.image ?? null;
  // Google avatars are safe to display; uploaded local photo takes priority
  const displayPhoto = photoUrl ?? googleAvatar;
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
      <Card>
        <SectionHead label="Profile Photo & Name" sub="Your photo appears across the dashboard and intelligence reports." />

        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 0", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: displayPhoto ? "transparent" : "var(--surface-3)", border: "2px solid var(--cyan-border)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {displayPhoto
                ? <img src={displayPhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                : <span style={{ fontSize: 22, fontWeight: 700, color: "var(--cyan)" }}>{initials}</span>
              }
            </div>
            {/* Upload overlay */}
            <button
              onClick={() => fileRef.current?.click()}
              style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%", background: "var(--surface-2)", border: "2px solid var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cyan-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              title="Upload photo"
            >
              <Camera style={{ width: 12, height: 12, color: "var(--cyan)" }} strokeWidth={1.8} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{userName}</p>
            <p style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3 }}>{userEmail}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => fileRef.current?.click()} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--cyan-border)"; e.currentTarget.style.color = "var(--cyan)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-4)"; }}>
                Upload photo
              </button>
              {photoUrl && (
                <button onClick={() => setPhotoUrl(null)} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "rgba(239,68,68,0.7)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; e.currentTarget.style.color = "#ef4444"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "rgba(239,68,68,0.7)"; }}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--cyan)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: "var(--cyan-subtle)", border: "1px solid var(--cyan-border)", alignSelf: "flex-start" }}>
            Premium
          </span>
        </div>

        <FieldRow label="Full Name"    value={userName}                       action="Edit" />
        <FieldRow label="Email"        value={userEmail}                      badge="Google" />
        <FieldRow label="Phone"        value="—"                              action="Add" />
        <FieldRow label="Time Zone"    value="America/New_York (ET)"          action="Change" />
        <FieldRow label="Member Since" value="April 2026"                     badge="Active" />
      </Card>

      <Card>
        <SectionHead label="Notification Preferences" />
        <Toggle label="AERA Intelligence Reports"  description="Weekly brand performance summaries delivered to your inbox."                defaultOn={true} />
        <Toggle label="Campaign Milestone Alerts"  description="Get notified when a campaign hits key performance thresholds."              defaultOn={true} />
        <Toggle label="Team Activity Digest"       description="Daily summary of team actions and updates."                                 defaultOn={false} />
        <Toggle label="APEX Platform Updates"      description="New features, improvements, and strategic intelligence newsletters."        defaultOn={true} />
        <Toggle label="Billing Reminders"          description="Upcoming invoice and payment confirmation notifications."                   defaultOn={true} />
      </Card>
    </div>
  );
}

/* ── Team tab ── */
function TeamTab() {
  const [members] = useState([
    { name: "Alex Morgan",   role: "Campaign Lead",     initials: "AM", status: "active"  },
    { name: "Jordan Pierce", role: "Creative Director", initials: "JP", status: "active"  },
    { name: "Riley Chen",    role: "Analyst",           initials: "RC", status: "pending" },
  ]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
      <Card>
        <SectionHead label="Team Members" sub="Manage access and roles for your organization." />
        {members.map((m) => (
          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-3)", border: "1px solid var(--border-mid)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-4)" }}>{m.initials}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{m.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 1 }}>{m.role}</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: m.status === "active" ? "#22c55e" : "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.status}</span>
            <ChevronRight style={{ width: 13, height: 13, color: "var(--text-6)" }} strokeWidth={1.6} />
          </div>
        ))}
        <button style={{ width: "100%", marginTop: 16, padding: "10px 0", borderRadius: 9, border: "1px dashed var(--border-mid)", background: "transparent", color: "var(--text-5)", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--cyan-border)"; e.currentTarget.style.color = "var(--cyan)"; e.currentTarget.style.background = "var(--cyan-subtle)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text-5)"; e.currentTarget.style.background = "transparent"; }}>
          + Invite Team Member
        </button>
      </Card>

      <Card>
        <SectionHead label="Permissions" sub="Control what each role can access in the dashboard." />
        {[
          { role: "Owner",            perms: "Full access — billing, security, team management" },
          { role: "Campaign Lead",    perms: "Campaigns, AERA Intelligence, deliverables" },
          { role: "Creative Director",perms: "Campaigns, deliverables, contact APEX" },
          { role: "Analyst",          perms: "Dashboard, deliverables, read-only intelligence" },
        ].map((r) => (
          <div key={r.role} style={{ padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{r.role}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 3 }}>{r.perms}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ── Billing tab ── */
function BillingTab() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
      <Card>
        <SectionHead label="Current Plan" />
        <div style={{ padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, rgba(45,212,255,0.07) 0%, var(--surface-2) 100%)", border: "1px solid var(--cyan-border)", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 10, color: "var(--cyan)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>APEX Premium</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", marginTop: 6 }}>$2,400<span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-5)" }}>/mo</span></p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px rgba(34,197,94,0.5)" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#22c55e", letterSpacing: "0.05em", textTransform: "uppercase" }}>Active</span>
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 10 }}>Next billing: April 15, 2026 · Auto-renews annually</p>
        </div>
        <FieldRow label="Payment Method" value="Visa ending in ···4821"  action="Update" />
        <FieldRow label="Billing Email"  value="billing@apexera.com"     action="Edit" />
        <FieldRow label="Billing Cycle"  value="Monthly"                 badge="Annual savings available" />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-4)"; }}>
            <Download style={{ width: 12, height: 12 }} strokeWidth={1.7} /> Invoices
          </button>
          <button style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-4)"; }}>
            <FileText style={{ width: 12, height: 12 }} strokeWidth={1.7} /> Usage Report
          </button>
        </div>
      </Card>

      <Card>
        <SectionHead label="Billing History" />
        {[
          { date: "Mar 15, 2026", amount: "$2,400", status: "Paid",    inv: "INV-2026-03" },
          { date: "Feb 15, 2026", amount: "$2,400", status: "Paid",    inv: "INV-2026-02" },
          { date: "Jan 15, 2026", amount: "$2,400", status: "Paid",    inv: "INV-2026-01" },
          { date: "Dec 15, 2025", amount: "$2,400", status: "Paid",    inv: "INV-2025-12" },
        ].map((row) => (
          <div key={row.inv} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <p style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{row.date}</p>
              <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{row.inv}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>{row.amount}</span>
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>{row.status}</span>
              <button style={{ fontSize: 11, color: "var(--text-5)", background: "none", border: "none", cursor: "pointer" }}>PDF</button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ── Privacy tab ── */
function PrivacyTab() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
      <Card>
        <SectionHead label="Data & Privacy Controls" sub="Control how AERA uses and stores your data." />
        <Toggle label="AERA Conversation Memory"   description="Allow AERA to remember context across sessions for personalized responses."      defaultOn={true} />
        <Toggle label="Usage Analytics"            description="Share anonymized usage data to improve AERA intelligence quality."                defaultOn={true} />
        <Toggle label="Campaign Benchmarking"      description="Contribute to anonymized industry benchmarks. No identifying data shared."         defaultOn={false} />
        <Toggle label="Marketing Communications"   description="Receive updates about new APEX features and intelligence reports."                defaultOn={true} />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-4)"; }}>
            <Download style={{ width: 12, height: 12 }} strokeWidth={1.7} /> Export My Data
          </button>
          <button style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "rgba(239,68,68,0.6)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; e.currentTarget.style.color = "#ef4444"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "rgba(239,68,68,0.6)"; }}>
            <Trash2 style={{ width: 12, height: 12 }} strokeWidth={1.7} /> Delete Account
          </button>
        </div>
      </Card>

      <Card>
        <SectionHead label="Data Retention" sub="How long AERA keeps your data." />
        {[
          { label: "Conversation History",   value: "90 days (configurable)" },
          { label: "Intelligence Insights",  value: "12 months" },
          { label: "Campaign Data",          value: "Retained indefinitely" },
          { label: "Audit Logs",             value: "24 months" },
          { label: "Voice Transcripts",      value: "30 days" },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{row.label}</p>
            <p style={{ fontSize: 12, color: "var(--text-5)" }}>{row.value}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ── Security tab ── */
function SecurityTab() {
  const [showKey, setShowKey] = useState(false);

  const AUDIT_LOG = [
    { event: "Logged in",                  detail: "Chrome · macOS · New York, NY",          time: "Today, 9:14 AM"     },
    { event: "AERA Voice Mode enabled",    detail: "Full intelligence loop started",           time: "Today, 9:16 AM"     },
    { event: "Campaign created",           detail: "Q2 Brand Refresh — Summer Identity",       time: "Yesterday, 3:02 PM" },
    { event: "API key rotated",            detail: "Key ending ···4f8a",                       time: "Mar 28, 2026"       },
    { event: "2FA enabled",                detail: "Authenticator app configured",             time: "Mar 15, 2026"       },
    { event: "Password changed",           detail: "Successful from trusted device",           time: "Mar 10, 2026"       },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
      {/* Security settings */}
      <Card>
        <SectionHead label="Security Settings" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 11, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Check style={{ width: 15, height: 15, color: "#22c55e" }} strokeWidth={2.2} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Two-Factor Authentication</p>
              <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>Authenticator app enabled</p>
            </div>
          </div>
          <button style={{ fontSize: 11, color: "var(--text-5)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-5)")}>Manage</button>
        </div>
        <FieldRow label="Password"        value="Last changed Mar 10, 2026"  action="Change" />
        <FieldRow label="Recovery Email"  value="recovery@apexera.com"       action="Edit" />
        {/* API Key */}
        <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, color: "var(--text-5)", letterSpacing: "0.02em", marginBottom: 6 }}>API Key</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <code style={{ fontSize: 12.5, color: "var(--text-2)", fontFamily: "ui-monospace, monospace" }}>
              {showKey ? "aera_live_sk_a7f3b2c9d1e4f8a0" : "aera_live_sk_···4f8a"}
            </code>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowKey(p => !p)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                {showKey ? <EyeOff style={{ width: 11, height: 11 }} strokeWidth={1.6} /> : <Eye style={{ width: 11, height: 11 }} strokeWidth={1.6} />}
                {showKey ? "Hide" : "Reveal"}
              </button>
              <button style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <Key style={{ width: 11, height: 11 }} strokeWidth={1.6} /> Rotate
              </button>
            </div>
          </div>
        </div>
        <Toggle label="Login Notifications"         description="Get notified by email when a new device signs into your account." defaultOn={true} />
        <Toggle label="Suspicious Activity Alerts"  description="Receive immediate alerts for unusual access patterns."              defaultOn={true} />
      </Card>

      {/* Active sessions */}
      <Card>
        <SectionHead label="Active Sessions" />
        {[
          { device: "Chrome on macOS",       location: "New York, NY",  time: "Active now",        current: true  },
          { device: "Safari on iPhone 16",   location: "New York, NY",  time: "2 hours ago",       current: false },
          { device: "Chrome on Windows 11",  location: "Chicago, IL",   time: "Yesterday, 4:12 PM",current: false },
        ].map((s) => (
          <div key={s.device} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 10, background: s.current ? "rgba(45,212,255,0.04)" : "var(--surface-2)", border: `1px solid ${s.current ? "var(--cyan-border)" : "var(--border)"}`, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <MonitorSmartphone style={{ width: 15, height: 15, color: s.current ? "var(--cyan)" : "var(--text-5)" }} strokeWidth={1.6} />
              <div>
                <p style={{ fontSize: 12.5, color: s.current ? "var(--text)" : "var(--text-2)", fontWeight: s.current ? 600 : 400 }}>{s.device}</p>
                <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 2 }}>{s.location} · {s.time}</p>
              </div>
            </div>
            {s.current
              ? <span style={{ fontSize: 10, fontWeight: 600, color: "var(--cyan)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Current</span>
              : <button style={{ fontSize: 11, color: "var(--text-5)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-5)")}>Revoke</button>
            }
          </div>
        ))}
        <button style={{ width: "100%", marginTop: 6, padding: "9px 0", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "rgba(239,68,68,0.6)", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "rgba(239,68,68,0.6)"; e.currentTarget.style.background = "transparent"; }}>
          Revoke All Other Sessions
        </button>
      </Card>

      {/* Audit log */}
      <Card>
        <SectionHead label="Audit Log" sub="A record of security-relevant events on your account." />
        {AUDIT_LOG.map((entry, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: i < AUDIT_LOG.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cyan)", marginTop: 5, flexShrink: 0, boxShadow: "0 0 4px rgba(45,212,255,0.4)" }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 500 }}>{entry.event}</p>
              <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{entry.detail}</p>
            </div>
            <span style={{ fontSize: 10.5, color: "var(--text-6)", flexShrink: 0 }}>{entry.time}</span>
          </div>
        ))}
        <button style={{ width: "100%", marginTop: 14, padding: "9px 0", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-5)"; }}>
          View Full Audit Log
        </button>
      </Card>
    </div>
  );
}

/* ── Support tab ── */
function SupportTab() {
  const [sent, setSent] = useState(false);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
      <Card>
        <SectionHead label="Request Human Support" sub="Your dedicated APEX account team responds within 2 business hours." />

        {sent ? (
          <div style={{ padding: "32px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Check style={{ width: 22, height: 22, color: "#22c55e" }} strokeWidth={2.2} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>Request Sent</p>
            <p style={{ fontSize: 13, color: "var(--text-5)", marginTop: 6 }}>Your team will respond within 2 business hours.</p>
            <button onClick={() => setSent(false)} style={{ marginTop: 20, padding: "8px 20px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", fontSize: 12, cursor: "pointer" }}>Send Another</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-5)", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Subject</label>
              <input placeholder="What do you need help with?" style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-5)", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Message</label>
              <textarea rows={5} placeholder="Describe your issue or request in detail…" style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-5)", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Priority</label>
              <select style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                <option>Normal — within 2 business hours</option>
                <option>Urgent — within 30 minutes</option>
                <option>Critical — immediate escalation</option>
              </select>
            </div>
            <button onClick={() => setSent(true)} style={{ padding: "11px 0", borderRadius: 10, border: "1px solid var(--cyan-border)", background: "var(--cyan-subtle)", color: "var(--cyan)", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(45,212,255,0.14)"; e.currentTarget.style.boxShadow = "0 0 18px rgba(45,212,255,0.18)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "var(--cyan-subtle)"; e.currentTarget.style.boxShadow = "none"; }}>
              Send Request
            </button>
          </div>
        )}
      </Card>

      <Card>
        <SectionHead label="Quick Resources" />
        {[
          { label: "APEX Onboarding Guide",   sub: "Get started with your intelligence layer"     },
          { label: "AERA Voice Mode Guide",    sub: "Learn how to use voice commands with AERA"    },
          { label: "Campaign Playbooks",       sub: "APEX-recommended campaign frameworks"          },
          { label: "API Documentation",        sub: "Developer docs for AERA integrations"          },
          { label: "Status Page",              sub: "Real-time system status for all APEX services" },
        ].map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{r.label}</p>
              <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{r.sub}</p>
            </div>
            <ChevronRight style={{ width: 14, height: 14, color: "var(--text-6)" }} strokeWidth={1.6} />
          </div>
        ))}
      </Card>

      {/* Security reminder */}
      <div style={{ gridColumn: "1 / -1", padding: "14px 18px", borderRadius: 11, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle style={{ width: 14, height: 14, color: "#eab308", flexShrink: 0 }} strokeWidth={1.8} />
        <p style={{ fontSize: 12, color: "var(--text-4)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-3)" }}>Security reminder:</strong> APEX will never ask for your password or API keys via email or chat. Report suspicious requests to your account team immediately.
        </p>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const active = TABS.find(t => t.id === activeTab)!;

  const CONTENT: Record<TabId, React.ReactNode> = {
    profile:  <ProfileTab />,
    team:     <TeamTab />,
    billing:  <BillingTab />,
    privacy:  <PrivacyTab />,
    security: <SecurityTab />,
    support:  <SupportTab />,
  };

  return (
    <PagePad>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p className="label-eyebrow mb-3">Account Center</p>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 32px)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1 }}>
          Account & Security
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--text-5)", marginTop: 8, letterSpacing: "-0.005em" }}>
          Manage your profile, team access, billing, and security in one place.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, padding: "4px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 24, width: "fit-content", flexWrap: "wrap" }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9, border: "none",
                background: isActive ? "var(--surface-3)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text-5)",
                fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
                letterSpacing: "-0.01em",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-3)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-5)"; }}
            >
              <Icon style={{ width: 13, height: 13 }} strokeWidth={isActive ? 2 : 1.7} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div key={activeTab}>
        {CONTENT[activeTab]}
      </div>
    </PagePad>
  );
}
