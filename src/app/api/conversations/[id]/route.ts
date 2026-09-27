import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, participants, users } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { broadcastToUsers } from "@/lib/realtime";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, description, addMemberIds, requesterId } = body as {
    name?: string;
    description?: string;
    addMemberIds?: string[];
    requesterId?: string;
  };
  if (name !== undefined || description !== undefined) {
    await db
      .update(conversations)
      .set({
        ...(name !== undefined ? { name: name.slice(0, 60) } : {}),
        ...(description !== undefined ? { description: description.slice(0, 200) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
  }
  if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
    const existing = await db.select().from(participants).where(eq(participants.conversationId, id));
    const existingIds = new Set(existing.map((p) => p.userId));
    const toAdd = addMemberIds.filter((x) => !existingIds.has(x));
    if (toAdd.length) {
      await db.insert(participants).values(
        toAdd.map((uid) => ({ conversationId: id, userId: uid, role: "member" }))
      );
    }
  }
  const parts = await db.select().from(participants).where(eq(participants.conversationId, id));
  broadcastToUsers(parts.map((p) => p.userId), {
    type: "conversation:updated",
    payload: { conversationId: id },
  });
  void requesterId;
  const rows = await db.select().from(conversations).where(eq(conversations.id, id));
  return NextResponse.json({ conversation: rows[0] ?? null });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parts = await db.select().from(participants).where(eq(participants.conversationId, id));
  const uids = parts.map((p) => p.userId);
  const userRows = uids.length ? await db.select().from(users).where(inArray(users.id, uids)) : [];
  const map = new Map(userRows.map((u) => [u.id, u]));
  return NextResponse.json({
    conversation: rows[0],
    members: parts.map((p) => ({ ...p, user: map.get(p.userId) ?? null })),
  });
}
