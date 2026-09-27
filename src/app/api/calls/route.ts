import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users } from "@/db/schema";
import { desc, or, eq, inArray } from "drizzle-orm";
import { broadcastToUsers } from "@/lib/realtime";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const rows = await db
    .select()
    .from(calls)
    .where(or(eq(calls.callerId, userId), eq(calls.receiverId, userId)))
    .orderBy(desc(calls.createdAt))
    .limit(60);
  const uids = Array.from(new Set(rows.flatMap((r) => [r.callerId, r.receiverId])));
  const userRows = uids.length ? await db.select().from(users).where(inArray(users.id, uids)) : [];
  const map = new Map(userRows.map((u) => [u.id, u]));
  return NextResponse.json({
    calls: rows.map((c) => ({
      ...c,
      caller: map.get(c.callerId) ?? null,
      receiver: map.get(c.receiverId) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { callerId, receiverId, type, status, durationSec } = body as {
    callerId?: string;
    receiverId?: string;
    type?: string;
    status?: string;
    durationSec?: number;
  };
  if (!callerId || !receiverId) return NextResponse.json({ error: "callerId + receiverId required" }, { status: 400 });
  const [row] = await db
    .insert(calls)
    .values({
      callerId,
      receiverId,
      type: type || "voice",
      status: status || "outgoing",
      durationSec: durationSec || 0,
    })
    .returning();
  broadcastToUsers([callerId, receiverId], { type: "call:new", payload: { call: row } });
  return NextResponse.json({ call: row });
}
