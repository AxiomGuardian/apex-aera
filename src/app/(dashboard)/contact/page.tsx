"use client";

import { useState } from "react";
import { Mail, MessageSquare, Video, Clock, ExternalLink, type LucideIcon } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { PagePad } from "@/components/layout/PagePad";

/* ─── Real team ─────────────────────────────────────────────────────────────
   Isaac  — Creative Lead · AERA Engineer · Strategic Director
   Mitchell — Account Manager · Strategic Director
──────────────────────────────────────────────────────────────────────────── */
const team = [
  {
    name: "Isaac",
    role: "Creative Lead · AERA Engineer · Strategic Director",
    online: true,
    initials: "IC",
    email: "guardian.v.artemis@gmail.com",
    note: "Brand strategy, AI systems & creative direction",
  },
  {
    name: "Mitchell",
    role: "Account Manager · Strategic Director",
    online: true,
    initials: "MI",
    email: "essequanvi1deri@gmail.com",
    note: "Your primary point of contact for all campaign work",
  },
];

/* ─── Contact actions ───────────────────────────────────────────────────── */
const contactActions = [
  {
    label: "Message on Slack",
    brandIcon: "Slack",
    icon: MessageSquare,
    desc: "Direct message via Slack workspace",
    href: "https://apex-team.slack.com",
    external: true,
  },
  {
    label: "Email Team",
    brandIcon: "Gmail",
    icon: Mail,
    desc: "Send a detailed brief or request",
    href: "mailto:guardian.v.artemis@gmail.com?subject=APEX%20AERA%20%E2%80%94%20Client%20Request&body=Hi%20Isaac%2C%0A%0A",
    external: false,
  },
  {
    label: "Book a Call",
    brandIcon: "Calendly",
    icon: Video,
    desc: "Schedule a strategy session",
    href: "https://calendly.com/apex-team",
    external: true,
  },
];

function TeamRow({
  member,
  index,
  isLast,
}: {
  member: (typeof team)[0];
  index: number;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={`mailto:${member.email}?subject=APEX%20AERA%20%E2%80%94%20Client%20Request`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center gap-4 sm:gap-5 px-5 sm:px-7 py-5 sm:py-[22px] opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${0.06 + index * 0.07}s`,
        animationFillMode: "forwards",
        background: hovered ? "var(--hover-fill-cyan)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        transition: "background 0.22s",
        cursor: "pointer",
        textDecoration: "none",
        display: "flex",
      }}
    >
      {/* Left accent */}
      <div style={{
        position: "absolute",
        left: 0, top: 12, bottom: 12,
        width: 2, borderRadius: 2,
        background: "linear-gradient(180deg, var(--cyan), rgba(45,212,255,0.2))",
        opacity: hovered ? 0.6 : 0,
        transition: "opacity 0.22s",
      }} />

      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: hovered ? "rgba(45,212,255,0.06)" : "var(--surface-2)",
          border: `1px solid ${hovered ? "rgba(45,212,255,0.18)" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s, border-color 0.2s",
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: hovered ? "var(--cyan)" : "var(--text-4)",
            letterSpacing: "0.06em",
            transition: "color 0.2s",
          }}>
            {member.initials}
          </span>
        </div>
        {/* Online indicator */}
        <div style={{
          position: "absolute",
          bottom: 1, right: 1,
          width: 9, height: 9, borderRadius: "50%",
          background: member.online ? "#22c55e" : "var(--surface-3)",
          boxShadow: member.online ? "0 0 5px rgba(34,197,94,0.45)" : "none",
          border: "1.5px solid var(--surface)",
          transition: "background 0.2s",
        }} />
      </div>

      {/* Name + role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 600,
          letterSpacing: "-0.015em",
          color: hovered ? "var(--text)" : "var(--text-2)",
          transition: "color 0.2s",
          lineHeight: 1,
        }}>
          {member.name}
        </p>
        <p style={{
          fontSize: 11, marginTop: 4,
          color: hovered ? "var(--text-4)" : "var(--text-5)",
          transition: "color 0.2s",
        }}>
          {member.role}
        </p>
        <p style={{
          fontSize: 11, marginTop: 3,
          color: "var(--text-6)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {member.note}
        </p>
      </div>

      {/* Right: email + status */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.04em",
          padding: "4px 10px", borderRadius: 20,
          color:      member.online ? "#22c55e"              : "var(--text-6)",
          background: member.online ? "rgba(34,197,94,0.07)" : "var(--surface-2)",
          border: `1px solid ${member.online ? "rgba(34,197,94,0.16)" : "var(--border)"}`,
        }}>
          {member.online ? "Available" : "Away"}
        </span>
        <span style={{
          fontSize: 10, color: hovered ? "var(--text-5)" : "var(--text-6)",
          transition: "color 0.2s",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <Mail style={{ width: 9, height: 9 }} />
          {member.email}
        </span>
      </div>
    </a>
  );
}

function ContactCard({ label, brandIcon, desc, href, external }: {
  label: string;
  brandIcon: string;
  icon: LucideIcon;
  desc: string;
  href: string;
  external: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        padding: "30px 22px 28px",
        borderRadius: 18,
        background: hovered ? "var(--hover-fill-cyan)" : "var(--surface)",
        border: `1px solid ${hovered ? "rgba(45,212,255,0.18)" : "var(--border)"}`,
        boxShadow: hovered ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        textAlign: "center" as const,
        cursor: "pointer",
        transition: "background 0.22s, border-color 0.22s, box-shadow 0.22s",
        position: "relative",
        overflow: "hidden",
        textDecoration: "none",
      }}
    >
      {/* Top cyan accent */}
      <div style={{
        position: "absolute",
        top: 0, left: "20%", right: "20%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.42), transparent)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.22s",
      }} />

      {/* Brand icon badge */}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: hovered ? "var(--surface-3)" : "var(--surface-2)",
        border: `1px solid ${hovered ? "var(--border-mid)" : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.22s, border-color 0.22s",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle brand color bloom on hover */}
        <BrandIcon
          name={brandIcon}
          size={22}
          color={hovered ? undefined : "var(--text-5)"}
        />
      </div>

      <div>
        <p style={{
          fontSize: 13, fontWeight: 500,
          letterSpacing: "-0.012em",
          color: hovered ? "var(--text-2)" : "var(--text-3)",
          transition: "color 0.2s",
          lineHeight: 1,
          display: "flex", alignItems: "center", gap: 5, justifyContent: "center",
        }}>
          {label}
          {external && (
            <ExternalLink style={{ width: 10, height: 10, opacity: 0.4 }} strokeWidth={1.5} />
          )}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 5, lineHeight: 1.55 }}>
          {desc}
        </p>
      </div>
    </a>
  );
}

export default function ContactPage() {
  return (
    <PagePad>
    <div
      className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up"
      style={{ animationFillMode: "forwards" }}
    >
      {/* Header */}
      <div>
        <p className="label-eyebrow mb-2.5">Your Team</p>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "var(--text)",
            lineHeight: 1,
          }}
        >
          Contact APEX
        </h2>
        <p style={{
          fontSize: 14, color: "var(--text-5)",
          marginTop: 12, fontWeight: 400, lineHeight: 1.6,
          letterSpacing: "0.005em",
        }}>
          Reach your dedicated team directly. Click a name to email, or use the contact options below.
        </p>
      </div>

      {/* Team list */}
      <div
        className="rounded-[18px] overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="px-5 sm:px-7 py-4 sm:py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="section-label">Team</span>
          <span style={{ fontSize: 11, color: "var(--text-6)" }}>
            {team.filter(m => m.online).length} available now
          </span>
        </div>

        {team.map((member, i) => (
          <TeamRow
            key={i}
            member={member}
            index={i}
            isLast={i === team.length - 1}
          />
        ))}
      </div>

      {/* Contact action cards */}
      <div>
        <p className="label-eyebrow mb-5">Get in Touch</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {contactActions.map((a) => (
            <ContactCard
              key={a.label}
              label={a.label}
              brandIcon={a.brandIcon}
              icon={a.icon}
              desc={a.desc}
              href={a.href}
              external={a.external}
            />
          ))}
        </div>
      </div>

      {/* Response commitment */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          padding: "20px 24px",
          borderRadius: 14,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
          position: "relative" as const,
          overflow: "hidden",
        }}
      >
        {/* Subtle left cyan stripe */}
        <div style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: 2, borderRadius: "0 2px 2px 0",
          background: "linear-gradient(180deg, rgba(45,212,255,0.5), rgba(45,212,255,0.1))",
        }} />

        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 1,
        }}>
          <Clock style={{ width: 14, height: 14, color: "var(--text-5)" }} strokeWidth={1.6} />
        </div>

        <div>
          <p style={{
            fontSize: 13, fontWeight: 500,
            color: "var(--text-2)", letterSpacing: "-0.01em", lineHeight: 1,
          }}>
            Response Commitment
          </p>
          <p style={{ fontSize: 12, color: "var(--text-5)", marginTop: 8, lineHeight: 1.75 }}>
            Your APEX team responds within 4 business hours. For urgent matters, use direct email
            or mark your message as Priority.
          </p>
        </div>
      </div>
    </div>
    </PagePad>
  );
}
