import { createClient } from "@/lib/supabase/server";
import { runAera } from "@/lib/aera/run";

/**
 * The same turn as /api/aera/act, streamed, so the person watches AERA work
 * instead of watching a spinner.
 *
 * Server sent events, one JSON object per line:
 *   { t: "phase", label }              she is thinking, or about to run a tool
 *   { t: "step",  tool, label, ok, ms } a tool finished
 *   { t: "done",  say, steps, ui, needsConfirm? }
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return new Response("Not signed in", { status: 401 });

  const { messages, confirm } = (await request.json()) as { messages: { role: string; content: string }[]; confirm?: boolean };
  if (!Array.isArray(messages) || messages.length === 0) return new Response("messages required", { status: 400 });

  const surface = request.headers.get("x-apex-surface") === "ios" ? "ios" : "web";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode("data: " + JSON.stringify(obj) + "\n\n")); } catch { /* client left */ }
      };
      try {
        const r = await runAera({
          supabase,
          userId: u.user!.id,
          messages,
          confirm,
          surface,
          onPhase: (label) => send({ t: "phase", label }),
          onStep: (s) => send({ t: "step", ...s }),
        });
        send({ t: "done", say: r.say, steps: r.steps, ui: r.ui, needsConfirm: r.needsConfirm ?? null, error: r.error ?? null });
      } catch (e) {
        send({ t: "done", say: "I hit a snag. Try that again in a moment.", steps: [], ui: [], needsConfirm: null, error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
