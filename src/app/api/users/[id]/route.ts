import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db.select().from(users).where(eq(users.id, id));
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user: rows[0] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<{ name: string; about: string; isOnline: boolean; publicKey: string }> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 40);
  if (typeof body.about === "string") patch.about = body.about.slice(0, 140);
  if (typeof body.isOnline === "boolean") patch.isOnline = body.isOnline;
  if (typeof body.publicKey === "string" && body.publicKey.length > 100)
    patch.publicKey = body.publicKey;
  await db
    .update(users)
    .set({ ...patch, lastSeen: new Date() })
    .where(eq(users.id, id));
  const rows = await db.select().from(users).where(eq(users.id, id));
  return NextResponse.json({ user: rows[0] ?? null });
}
