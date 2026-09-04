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

/** Shared dark, cyan-accented shell for every APEX email. */
function shell(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px"><tr><td style="border-radius:999px;background:#2DD4FF"><a href="' + cta.url + '" style="display:inline-block;padding:13px 28px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#04131a;text-decoration:none;border-radius:999px">' + cta.label + '</a></td></tr></table>'
    : "";
  return (
    '<!doctype html><html><body style="margin:0;padding:0;background:#0c0c0c">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0c0c0c;padding:40px 16px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px">' +
    '<tr><td style="height:2px;background:linear-gradient(90deg,transparent,#2DD4FF,transparent);border-radius:20px 20px 0 0"></td></tr>' +
    '<tr><td style="padding:36px 36px 12px;font-family:Inter,Helvetica,Arial,sans-serif">' +
    '<div style="font-size:12px;letter-spacing:0.18em;color:#7fd9f7;font-weight:700;margin-bottom:22px">APEX AERA</div>' +
    '<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#ececec;font-weight:800">' + title + '</h1>' +
    '<div style="font-size:14.5px;line-height:1.65;color:#a8a8a8">' + bodyHtml + '</div>' +
    button +
    '</td></tr>' +
    '<tr><td style="padding:18px 36px 32px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.6;color:#5a5a5a">' +
    'You are receiving this because someone at APEX invited you or you have an APEX AERA workspace. If this was not expected, you can ignore this email.' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

export function inviteEmail(opts: { brandName: string; link: string }) {
  const subject = "You are invited to APEX AERA for " + opts.brandName;
  const html = shell(
    "Your workspace for " + opts.brandName + " is ready.",
    "<p style=\"margin:0 0 12px\">APEX has set up a private AERA workspace for <strong style=\"color:#e0e0e0\">" + opts.brandName + "</strong>. AERA is your brand companion: it studies your content, researches your market, writes and schedules your posts, and reports back, around the clock.</p>" +
    "<p style=\"margin:0\">Tap the button to set your name and password. The link is personal to you and expires after a short while.</p>",
    { label: "Set up my account", url: opts.link }
  );
  const text =
    "Your APEX AERA workspace for " + opts.brandName + " is ready.\n\n" +
    "Set your name and password here: " + opts.link + "\n\n" +
    "AERA studies your content, researches your market, writes and schedules your posts, and reports back, around the clock.\n";
  return { subject, html, text };
}
