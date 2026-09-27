import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, participants, users, messages } from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { broadcastToUsers } from "@/lib/realtime";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const myParts = await db.select().from(participants).where(eq(participants.userId, userId));
  if (myParts.length === 0) return NextResponse.json({ conversations: [] });
  const convIds = myParts.map((p) => p.conversationId);

  const convs = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, convIds))
    .orderBy(desc(conversations.updatedAt));

  // participants + user info
  const allParts = await db
    .select()
    .from(participants)
    .where(inArray(participants.conversationId, convIds));

  const userIds = Array.from(new Set(allParts.map((p) => p.userId)));
  const userRows = userIds.length
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  // last message per conversation (envelope only — client decrypts)
  const lastMsgs = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .orderBy(desc(messages.createdAt))
    .limit(300);
  const lastByConv = new Map<string, (typeof lastMsgs)[number]>();
  for (const m of lastMsgs) {
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
  }

  // unread counts
  const myLastRead = new Map(myParts.map((p) => [p.conversationId, p.lastReadAt]));
  const result = convs.map((c) => {
    const parts = allParts.filter((p) => p.conversationId === c.id);
    const members = parts.map((p) => ({
      ...p,
      user: userMap.get(p.userId) ?? null,
    }));
    const last = lastByConv.get(c.id) ?? null;
    const readAt = myLastRead.get(c.id);
    let unread = 0;
    if (last && readAt) {
      // count approximation from fetched window
      unread = lastMsgs.filter(
        (m) =>
          m.conversationId === c.id &&
          new Date(m.createdAt).getTime() > new Date(readAt).getTime() &&
          m.senderId !== userId
      ).length;
    }
    return { ...c, members, lastMessage: last, unread };
  });

  result.sort((a, b) => {
    const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
    const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
    return bt - at;
  });

  return NextResponse.json({ conversations: result });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorId, memberIds, isGroup, name, description } = body as {
      creatorId: string;
      memberIds: string[];
      isGroup?: boolean;
      name?: string;
      description?: string;
    };
    if (!creatorId || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: "creatorId and memberIds required" }, { status: 400 });
    }
    const allIds = Array.from(new Set([creatorId, ...memberIds]));
    if (!isGroup && allIds.length === 2) {
      // return existing DM if present
      const existing = await db.execute(sql`
        SELECT c.id FROM conversations c
        WHERE c.is_group = false AND (
          SELECT COUNT(*) FROM participants p WHERE p.conversation_id = c.id
        ) = 2 AND NOT EXISTS (
          SELECT 1 FROM participants p
          WHERE p.conversation_id = c.id AND p.user_id NOT IN (${sql.join(allIds.map((id) => sql`${id}`), sql`, `)})
        )
      `);
      // fallback: brute force check
      const mine = await db.select().from(participants).where(eq(participants.userId, creatorId));
      const otherId = allIds.find((id) => id !== creatorId)!;
      for (const p of mine) {
        const inConv = await db
          .select()
          .from(participants)
          .where(eq(participants.conversationId, p.conversationId));
        const ids = inConv.map((x) => x.userId).sort();
        if (ids.length === 2 && ids.includes(otherId)) {
          const convRows = await db.select().from(conversations).where(eq(conversations.id, p.conversationId));
          if (convRows[0] && !convRows[0].isGroup) {
            return NextResponse.json({ conversation: convRows[0], reused: true });
          }
        }
      }
      void existing;
    }

    const groupColors = ["#008069", "#6b21a8", "#0e7490", "#b45309", "#be123c", "#166534"];
    const [conv] = await db
      .insert(conversations)
      .values({
        isGroup: !!isGroup,
        name: isGroup ? (name?.trim().slice(0, 60) || "New group") : null,
        description: description?.slice(0, 200) ?? null,
        avatarColor: groupColors[Math.floor(Math.random() * groupColors.length)],
        createdBy: creatorId,
      })
      .returning();

    await db.insert(participants).values(
      allIds.map((uid) => ({
        conversationId: conv.id,
        userId: uid,
        role: uid === creatorId ? "admin" : "member",
      }))
    );

    broadcastToUsers(allIds, {
      type: "conversation:new",
      payload: { conversationId: conv.id },
    });

    return NextResponse.json({ conversation: conv });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
