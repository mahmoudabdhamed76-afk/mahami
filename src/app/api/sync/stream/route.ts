import { currentUser } from "@/server/auth";
import { hub } from "@/server/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel: stream is recycled before this; EventSource reconnects automatically
const MAX_MS = Number(process.env.SSE_MAX_MS ?? 0);

/** Server-Sent Events: pings the client whenever its data changes on any device. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let pending: NodeJS.Timeout | null = null;
      const send = (s: string) => { if (!closed) try { controller.enqueue(enc.encode(s)); } catch { cleanup(); } };
      send(`retry: 800\nevent: ready\ndata: {}\n\n`);
      const unsubscribe = hub.subscribe(user.id, () => {
        // Coalesce bursts (a batch push produces many NOTIFYs)
        if (pending) return;
        pending = setTimeout(() => { pending = null; send(`event: change\ndata: ${Date.now()}\n\n`); }, 120);
      });
      const ping = setInterval(() => send(`: ping\n\n`), 25_000);
      const recycle = MAX_MS > 0 ? setTimeout(() => cleanup(), MAX_MS) : null;
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        if (recycle) clearTimeout(recycle);
        if (pending) clearTimeout(pending);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() { cleanup(); },
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
