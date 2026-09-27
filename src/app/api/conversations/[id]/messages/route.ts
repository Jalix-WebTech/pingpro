import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, participants, conversations, users } from "@/db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { broadcastToUsers } from "@/lib/realtime";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const mem = await db
    .select()
    .from(participants)
    .where(and(eq(participants.conversationId, id), eq(participants.userId, userId)));
  if (mem.length === 0) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const convRows = await db.select().from(conversations).where(eq(conversations.id, id));
  const parts = await db.select().from(participants).where(eq(participants.conversationId, id));
  const uids = parts.map((p) => p.userId);
  const userRows = await db.select().from(users).where(inArray(users.id, uids));
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  return NextResponse.json({
    conversation: convRows[0] ?? null,
    members: parts.map((p) => ({ ...p, user: userMap.get(p.userId) ?? null })),
    messages: rows,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { senderId, ciphertext, iv, encryptedKeys, messageType, replyToId } = body as {
      senderId: string;
      ciphertext: string;
      iv: string;
      encryptedKeys: Record<string, string>;
      messageType?: string;
      replyToId?: string | null;
    };
    if (!senderId || !ciphertext || !iv || !encryptedKeys) {
      return NextResponse.json({ error: "Invalid encrypted envelope" }, { status: 400 });
    }
    const mem = await db
      .select()
      .from(participants)
      .where(and(eq(participants.conversationId, id), eq(participants.userId, senderId)));
    if (mem.length === 0) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: id,
        senderId,
        ciphertext,
        iv,
        encryptedKeys,
        messageType: messageType || "text",
        replyToId: replyToId || null,
      })
      .returning();

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, id));

    const parts = await db.select().from(participants).where(eq(participants.conversationId, id));
    const targetIds = parts.map((p) => p.userId);
    broadcastToUsers(targetIds, {
      type: "message:new",
      payload: { conversationId: id, message: msg },
    });
    broadcastToUsers(targetIds, {
      type: "conversation:updated",
      payload: { conversationId: id },
    });

    return NextResponse.json({ message: msg });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  const userId = searchParams.get("userId");
  if (!messageId || !userId) return NextResponse.json({ error: "messageId + userId required" }, { status: 400 });
  const rows = await db.select().from(messages).where(eq(messages.id, messageId));
  const msg = rows[0];
  if (!msg || msg.conversationId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.senderId !== userId) return NextResponse.json({ error: "Only sender can delete" }, { status: 403 });
  await db.delete(messages).where(eq(messages.id, messageId));
  const parts = await db.select().from(participants).where(eq(participants.conversationId, id));
  broadcastToUsers(parts.map((p) => p.userId), {
    type: "message:deleted",
    payload: { conversationId: id, messageId },
  });
  return NextResponse.json({ ok: true });
}
