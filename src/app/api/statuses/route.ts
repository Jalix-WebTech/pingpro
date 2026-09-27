import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { statuses, users } from "@/db/schema";
import { desc, gt, inArray } from "drizzle-orm";
import { broadcastAll } from "@/lib/realtime";

export async function GET() {
  const now = new Date();
  const rows = await db.select().from(statuses).where(gt(statuses.expiresAt, now)).orderBy(desc(statuses.createdAt)).limit(100);
  const uids = Array.from(new Set(rows.map((r) => r.userId)));
  const userRows = uids.length ? await db.select().from(users).where(inArray(users.id, uids)) : [];
  const map = new Map(userRows.map((u) => [u.id, u]));
  return NextResponse.json({
    statuses: rows.map((s) => ({ ...s, user: map.get(s.userId) ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, textContent, bgColor } = body as { userId?: string; textContent?: string; bgColor?: string };
  if (!userId || !textContent?.trim()) return NextResponse.json({ error: "userId + textContent required" }, { status: 400 });
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  const [row] = await db
    .insert(statuses)
    .values({ userId, textContent: textContent.trim().slice(0, 280), bgColor: bgColor || "#008069", expiresAt })
    .returning();
  broadcastAll({ type: "status:new", payload: { status: row } });
  return NextResponse.json({ status: row });
}
