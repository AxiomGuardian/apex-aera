import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { adminClient } from "@/lib/engines/core";
import { markPastDue, markPaid, markCanceled } from "@/lib/brands/lifecycle";

/**
 * Stripe -> APEX. Dormant until STRIPE_WEBHOOK_SECRET is set.
 * Subscribe this URL in Stripe to: invoice.payment_failed, invoice.paid,
 * customer.subscription.deleted. Brands are matched by stripe_customer_id.
 */

function verify(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5 min tolerance
  const expected = createHmac("sha256", secret).update(t + "." + payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const payload = await request.text();
  if (!verify(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as { type: string; data: { object: { customer?: string; id?: string } } };
  const customer = event.data.object.customer;
  if (!customer) return NextResponse.json({ ok: true, ignored: "no customer" });

  const admin = adminClient();
  const { data: brand } = await admin.from("brands").select("id").eq("stripe_customer_id", customer).maybeSingle();
  if (!brand) return NextResponse.json({ ok: true, ignored: "no brand for customer" });

  switch (event.type) {
    case "invoice.payment_failed":
      await markPastDue(admin, brand.id);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await markPaid(admin, brand.id);
      break;
    case "customer.subscription.deleted":
      await markCanceled(admin, brand.id);
      break;
    default:
      return NextResponse.json({ ok: true, ignored: event.type });
  }
  return NextResponse.json({ ok: true });
}
