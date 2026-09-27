import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, conversations, participants, messages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const AVATAR_COLORS = [
  "#008069",
  "#7f1d1d",
  "#1e3a8a",
  "#065f46",
  "#7c2d12",
  "#581c87",
  "#0c4a6e",
  "#831843",
  "#365314",
  "#134e4a",
];

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exclude = searchParams.get("exclude");
  const all = await db.select().from(users).orderBy(desc(users.lastSeen));
  const filtered = exclude ? all.filter((u) => u.id !== exclude) : all;
  return NextResponse.json({ users: filtered });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, publicKey, about } = body as {
      name?: string;
      phone?: string;
      publicKey?: string;
      about?: string;
    };
    if (!name?.trim() || !phone?.trim() || !publicKey) {
      return NextResponse.json(
        { error: "name, phone and publicKey are required" },
        { status: 400 }
      );
    }
    const normalizedPhone = phone.trim();
    // If phone exists, rotate key (re-login on new device) and update name
    const existing = await db.select().from(users);
    const found = existing.find((u) => u.phone === normalizedPhone);
    if (found) {
      const { eq } = await import("drizzle-orm");
      await db
        .update(users)
        .set({
          publicKey,
          name: name.trim(),
          about: about?.trim() || found.about,
          isOnline: true,
          lastSeen: new Date(),
        })
        .where(eq(users.id, found.id));
      const [updated] = await db.select().from(users).then((rows) => rows.filter((r) => r.id === found.id));
      return NextResponse.json({ user: updated ?? found, rotated: true });
    }
    const [created] = await db
      .insert(users)
      .values({
        name: name.trim().slice(0, 40),
        phone: normalizedPhone.slice(0, 24),
        about: (about?.trim() || "Hey there! I am using PingPro.").slice(0, 140),
        avatarColor: pickColor(normalizedPhone),
        publicKey,
        isOnline: true,
        lastSeen: new Date(),
      })
      .returning();

    // Auto-create a welcome DM with PingPro Team bot (readable PLAIN envelope)
    try {
      const all = await db.select().from(users);
      const bot = all.find((u) => u.name === "PingPro Team" && u.id !== created.id);
      if (bot) {
        const [conv] = await db
          .insert(conversations)
          .values({ isGroup: false, avatarColor: "#008069", createdBy: bot.id })
          .returning();
        await db.insert(participants).values([
          { conversationId: conv.id, userId: bot.id, role: "member" },
          { conversationId: conv.id, userId: created.id, role: "member" },
        ]);
        const welcomes = [
          `👋 Welcome to PingPro, ${created.name.split(" ")[0]}! Your chats here are end-to-end encrypted.`,
          "🔒 Only you and the people you're chatting with can read messages. Not even our servers can.",
          "Tap the + button to start a new chat, create a group, or share a status update.",
        ];
        for (const text of welcomes) {
          const body = JSON.stringify({ text, kind: "text", sentAt: Date.now() });
          await db.insert(messages).values({
            conversationId: conv.id,
            senderId: bot.id,
            ciphertext: Buffer.from(body, "utf8").toString("base64"),
            iv: "PLAIN",
            encryptedKeys: {},
            messageType: "text",
          });
        }
      }
    } catch {
      // non-fatal
    }
    return NextResponse.json({ user: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create user";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "That phone number is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
