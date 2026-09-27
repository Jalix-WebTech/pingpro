import { NextRequest, NextResponse } from "next/server";
import { broadcastToUsers, broadcastAll } from "@/lib/realtime";
import { db } from "@/db";
import { participants, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { kind } = body as { kind?: string };
  if (kind === "typing") {
    const { conversationId, userId, userName, isTyping } = body as {
      conversationId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    };
    if (!conversationId || !userId) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const parts = await db.select().from(participants).where(eq(participants.conversationId, conversationId));
    const targets = parts.map((p) => p.userId).filter((id) => id !== userId);
    broadcastToUsers(targets, { type: "typing", payload: { conversationId, userId, userName, isTyping } });
    return NextResponse.json({ ok: true });
  }
  if (kind === "presence") {
    const { userId, isOnline } = body as { userId: string; isOnline: boolean };
    if (!userId) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await db.update(users).set({ isOnline: !!isOnline, lastSeen: new Date() }).where(eq(users.id, userId));
    broadcastAll({ type: "presence", payload: { userId, isOnline: !!isOnline, lastSeen: new Date().toISOString() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
