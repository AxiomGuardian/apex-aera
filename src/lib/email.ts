/**
 * Transactional email via Resend's REST API (no SDK needed).
 * Activates when RESEND_API_KEY is set. EMAIL_FROM must be a verified
 * sender on your Resend domain, e.g. "APEX AERA <aera@apexaera.com>".
 */

const RESEND_URL = "https://api.resend.com/emails";

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const from = process.env.EMAIL_FROM ?? "APEX AERA <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text }),
    });
    const json = (await res.json()) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { ok: false, error: json.message ?? json.name ?? "Resend error " + res.status };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

/** Shared dark, cyan-accented shell for every APEX email. Table based for email clients. */
function shell(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:30px 0 6px"><tr>' +
      '<td style="border-radius:999px;background:#2DD4FF;background-image:linear-gradient(180deg,#5fe0ff,#18a0c8);box-shadow:0 10px 30px rgba(45,212,255,0.25)">' +
      '<a href="' + cta.url + '" style="display:inline-block;padding:14px 30px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#04131a;text-decoration:none;border-radius:999px;letter-spacing:0.01em">' + cta.label + ' &rarr;</a>' +
      '</td></tr></table>' +
      '<p style="margin:14px 0 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.6;color:#5d6068">If the button does not work, copy this link into your browser:<br><a href="' + cta.url + '" style="color:#7fd9f7;word-break:break-all;text-decoration:none">' + cta.url + '</a></p>'
    : "";
  return (
    '<!doctype html><html><body style="margin:0;padding:0;background:#0a0b0e">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0b0e;background-image:radial-gradient(ellipse 70% 40% at 50% 0%,rgba(45,212,255,0.10),transparent 60%);padding:44px 16px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">' +
    // Wordmark
    '<tr><td align="center" style="padding-bottom:22px;font-family:Inter,Helvetica,Arial,sans-serif">' +
    '<table role="presentation" cellspacing="0" cellpadding="0"><tr>' +
    '<td style="width:34px;height:34px;border-radius:50%;background:rgba(45,212,255,0.10);border:1px solid rgba(45,212,255,0.35);text-align:center;vertical-align:middle;color:#2DD4FF;font-size:16px;line-height:34px">&#9651;</td>' +
    '<td style="padding-left:10px;font-size:12px;letter-spacing:0.28em;color:#e8e8e8;font-weight:700">APEX AERA</td>' +
    '</tr></table></td></tr>' +
    // Card
    '<tr><td style="background:#121418;border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">' +
    '<tr><td style="height:2px;background:linear-gradient(90deg,transparent,#2DD4FF 50%,transparent)"></td></tr>' +
    '<tr><td style="padding:38px 38px 14px;font-family:Inter,Helvetica,Arial,sans-serif">' +
    '<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#f0f0f0;font-weight:800;letter-spacing:-0.02em">' + title + '</h1>' +
    '<div style="font-size:14.5px;line-height:1.7;color:#a9abb2">' + bodyHtml + '</div>' +
    button +
    '</td></tr>' +
    '<tr><td style="padding:18px 38px 30px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#55585f;border-top:1px solid rgba(255,255,255,0.06)">' +
    'You are receiving this because someone at APEX invited you or you have an APEX AERA workspace. If this was not expected, you can ignore this email.' +
    '</td></tr></table></td></tr>' +
    // Footer
    '<tr><td align="center" style="padding-top:22px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#45484f">' +
    '&copy; ' + new Date().getFullYear() + ' APEX AERA &nbsp;&middot;&nbsp; <a href="https://www.apexaera.com/privacy" style="color:#6a6d75;text-decoration:none">Privacy</a> &nbsp;&middot;&nbsp; <a href="https://www.apexaera.com/terms" style="color:#6a6d75;text-decoration:none">Terms</a>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

export function inviteEmail(opts: { brandName: string; link: string }) {
  const subject = "You are invited to APEX AERA for " + opts.brandName;
  const html = shell(
    "Your workspace for " + opts.brandName + " is ready.",
    "<p style=\"margin:0 0 14px\">APEX has set up a private AERA workspace for <strong style=\"color:#e6e6e6\">" + opts.brandName + "</strong>.</p>" +
    "<p style=\"margin:0 0 14px\">AERA is your brand companion. It studies your content, researches your market, writes and schedules your posts, publishes them, and reports back. Around the clock, in your voice.</p>" +
    "<p style=\"margin:0\">Tap the button to choose your name and password. The link is personal to you and expires after a short while.</p>",
    { label: "Set up my account", url: opts.link }
  );
  const text =
    "Your APEX AERA workspace for " + opts.brandName + " is ready.\n\n" +
    "Set your name and password here: " + opts.link + "\n\n" +
    "AERA studies your content, researches your market, writes and schedules your posts, and reports back, around the clock.\n";
  return { subject, html, text };
}

/* ---------- Lifecycle emails (sent by the heartbeat, once each) ---------- */

const PORTAL = "https://www.apexaera.com";

export function pastDueEmail(opts: { brandName: string; graceDays: number }) {
  const subject = "Payment issue on your APEX AERA workspace for " + opts.brandName;
  const html = shell(
    "We could not process your payment.",
    "<p style=\"margin:0 0 14px\">The latest payment for <strong style=\"color:#e6e6e6\">" + opts.brandName + "</strong> did not go through. Nothing has changed yet: AERA is still working and your content is safe.</p>" +
    "<p style=\"margin:0\">If it is not resolved within " + opts.graceDays + " days, the workspace will be paused and moved to the archive, where it stays intact for 30 more days. Update your payment method and everything continues without a gap.</p>",
    { label: "Open my workspace", url: PORTAL + "/login" }
  );
  const text = "The latest payment for " + opts.brandName + " did not go through. AERA is still working. If it is not resolved within " + opts.graceDays + " days the workspace will be paused and archived (kept intact for 30 more days). Sign in: " + PORTAL + "/login\n";
  return { subject, html, text };
}

export function archivedEmail(opts: { brandName: string; reason: "unpaid" | "inactive" | "canceled" | "manual"; windowDays: number }) {
  const why =
    opts.reason === "unpaid" ? "the payment issue was not resolved in time" :
    opts.reason === "inactive" ? "there has been no activity for a long while" :
    opts.reason === "canceled" ? "the subscription was canceled" :
    "your APEX contact archived it";
  const subject = "Your APEX AERA workspace for " + opts.brandName + " has been paused";
  const html = shell(
    "Your workspace is paused.",
    "<p style=\"margin:0 0 14px\">The workspace for <strong style=\"color:#e6e6e6\">" + opts.brandName + "</strong> has been archived because " + why + ". AERA has stopped scheduling and publishing.</p>" +
    "<p style=\"margin:0\">Everything is kept exactly as it was for <strong style=\"color:#e6e6e6\">" + opts.windowDays + " days</strong>. Restoring it brings back all content, captions, reports, and connections with nothing lost. After that window it is deleted for good.</p>",
    { label: "Talk to APEX", url: PORTAL + "/request-access" }
  );
  const text = "The workspace for " + opts.brandName + " has been archived because " + why + ". Everything is kept for " + opts.windowDays + " days and can be restored in full. After that it is deleted. Reach us at " + PORTAL + "\n";
  return { subject, html, text };
}

export function purgeWarningEmail(opts: { brandName: string; daysLeft: number }) {
  const subject = opts.daysLeft + " days until your APEX AERA workspace is deleted";
  const html = shell(
    opts.daysLeft + " days left.",
    "<p style=\"margin:0 0 14px\">The archived workspace for <strong style=\"color:#e6e6e6\">" + opts.brandName + "</strong> will be permanently deleted in <strong style=\"color:#e6e6e6\">" + opts.daysLeft + " days</strong>: all content, captions, scheduled posts, reports, and chat history.</p>" +
    "<p style=\"margin:0\">If you want to keep it, reply to this email or reach out to your APEX contact and it can be restored in one click.</p>",
    { label: "Keep my workspace", url: PORTAL + "/request-access" }
  );
  const text = "The archived workspace for " + opts.brandName + " will be permanently deleted in " + opts.daysLeft + " days. To keep it, contact APEX: " + PORTAL + "\n";
  return { subject, html, text };
}

export function inactivityEmail(opts: { brandName: string; quietDays: number; archiveInDays: number }) {
  const subject = "Still with us? Your APEX AERA workspace for " + opts.brandName;
  const html = shell(
    "It has been quiet.",
    "<p style=\"margin:0 0 14px\">Nothing new has come into the workspace for <strong style=\"color:#e6e6e6\">" + opts.brandName + "</strong> in about " + opts.quietDays + " days. AERA can only work with what you give it.</p>" +
    "<p style=\"margin:0\">Drop in one video and everything picks right back up. If nothing arrives in the next " + opts.archiveInDays + " days, the workspace will be paused and archived, still fully restorable.</p>",
    { label: "Upload something", url: PORTAL + "/login" }
  );
  const text = "Nothing new has come into the workspace for " + opts.brandName + " in about " + opts.quietDays + " days. Upload one video and AERA picks right back up. If nothing arrives in " + opts.archiveInDays + " days the workspace will be archived. Sign in: " + PORTAL + "/login\n";
  return { subject, html, text };
}
