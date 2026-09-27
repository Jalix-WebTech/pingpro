import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { broadcastToUsers } from "@/lib/realtime";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const now = new Date();
  await db
    .update(participants)
    .set({ lastReadAt: now })
    .where(and(eq(participants.conversationId, id), eq(participants.userId, userId)));
  const parts = await db.select().from(participants).where(eq(participants.conversationId, id));
  broadcastToUsers(parts.map((p) => p.userId), {
    type: "message:read",
    payload: { conversationId: id, userId, lastReadAt: now.toISOString() },
  });
  return NextResponse.json({ ok: true });
}
