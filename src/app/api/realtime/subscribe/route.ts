import { NextRequest } from "next/server";
import { subscribe, type RealtimeEvent } from "@/lib/realtime";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { broadcastAll } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return new Response("userId required", { status: 400 });
  }

  // mark online
  db.update(users).set({ isOnline: true, lastSeen: new Date() }).where(eq(users.id, userId)).catch(() => {});
  broadcastAll({ type: "presence", payload: { userId, isOnline: true, lastSeen: new Date().toISOString() } });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // closed
        }
      };
      // hello
      send({ type: "presence", payload: { hello: true, userId } });
      const unsubscribe = subscribe({ userId, send });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // ignore
        }
      }, 20000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        db.update(users).set({ isOnline: false, lastSeen: new Date() }).where(eq(users.id, userId)).catch(() => {});
        broadcastAll({ type: "presence", payload: { userId, isOnline: false, lastSeen: new Date().toISOString() } });
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
