"use client";

import { useActionState } from "react";
import { KIT_ROLES } from "@/lib/kit/constants";
import { submitWaitlist, type WaitlistState } from "@/lib/kit/waitlist";
import { KitButton } from "@/components/kit/ui";

const INITIAL: WaitlistState = { ok: false };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitWaitlist, INITIAL);

  if (state.ok) {
    return (
      <div className="kit-card kit-card-static p-8 sm:p-10" role="status">
        <p className="kit-overline">Received</p>
        <p className="kit-display mt-4 text-2xl">You are on the list.</p>
        <p className="mt-3 leading-relaxed text-[#A8B0C0]">
          {state.message ?? "When the tools are ready, you’ll be among the first to know."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="kit-card kit-card-static relative p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className="kit-label" htmlFor="kit-name">
            Name
          </label>
          <input
            id="kit-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            minLength={2}
            maxLength={80}
            className="kit-input"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="kit-label" htmlFor="kit-email">
            Email
          </label>
          <input
            id="kit-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={120}
            className="kit-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="kit-label" htmlFor="kit-role">
            Role
          </label>
          <select id="kit-role" name="role" required defaultValue="" className="kit-select">
            <option value="" disabled>
              Choose one
            </option>
            {KIT_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="kit-label" htmlFor="kit-message">
            Message
          </label>
          <textarea
            id="kit-message"
            name="message"
            rows={5}
            maxLength={2000}
            className="kit-textarea"
            placeholder="Optional. What you shepherd, build, or need."
          />
        </div>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="kit-company">Company</label>
          <input id="kit-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {state.error ? (
        <p className="mt-4 text-sm text-[#D4AF37]" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#A8B0C0]">
          When the tools are ready, you’ll be among the first to know.
        </p>
        <KitButton type="submit" disabled={pending}>
          {pending ? "Sending…" : "Leave your name"}
        </KitButton>
      </div>
    </form>
  );
}
