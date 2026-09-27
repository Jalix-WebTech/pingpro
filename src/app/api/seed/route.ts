import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, conversations, participants, statuses, calls, messages } from "@/db/schema";
import { webcrypto } from "node:crypto";

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  // Node has Buffer
  return Buffer.from(bytes).toString("base64");
}

async function genPublicKeyB64(): Promise<string> {
  const pair = (await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  )) as CryptoKeyPair;
  const spki = await webcrypto.subtle.exportKey("spki", pair.publicKey);
  return bufToB64(spki);
}

function plainEnvelope(text: string) {
  const body = JSON.stringify({ text, kind: "text", sentAt: Date.now() });
  return {
    ciphertext: Buffer.from(body, "utf8").toString("base64"),
    iv: "PLAIN",
    encryptedKeys: {},
  };
}

export async function POST() {
  try {
    const existing = await db.select().from(users);
    if (existing.length >= 3) {
      return NextResponse.json({ ok: true, skipped: true, count: existing.length });
    }

    const demos = [
      { name: "PingPro Team", phone: "+1 555 010 0000", about: "Official PingPro announcements ✅", avatarColor: "#008069" },
      { name: "Sarah Chen", phone: "+1 555 014 2210", about: "Product Designer @ Nexora 🎨", avatarColor: "#7c2d12" },
      { name: "Marcus Webb", phone: "+1 555 017 8891", about: "Engineering Lead — always shipping 🚢", avatarColor: "#1e3a8a" },
      { name: "Priya Sharma", phone: "+1 555 011 3098", about: "Marketing Director | Let's connect!", avatarColor: "#831843" },
      { name: "David Okafor", phone: "+1 555 019 4456", about: "Founder @ StartupLab 💡", avatarColor: "#065f46" },
      { name: "Elena Rodriguez", phone: "+1 555 013 7782", about: "Customer Success Manager ☕", avatarColor: "#581c87" },
    ];

    const createdUsers = [];
    for (const d of demos) {
      const pub = await genPublicKeyB64();
      const [u] = await db
        .insert(users)
        .values({
          name: d.name,
          phone: d.phone,
          about: d.about,
          avatarColor: d.avatarColor,
          publicKey: pub,
          isOnline: Math.random() > 0.5,
          lastSeen: new Date(Date.now() - Math.floor(Math.random() * 3600_000)),
        })
        .returning()
        .catch(() => [] as typeof existing);
      if (u) createdUsers.push(u);
    }
    const allUsers = [...existing, ...createdUsers];
    const byName = new Map(allUsers.map((u) => [u.name, u]));
    const team = byName.get("PingPro Team")!;

    // statuses
    const statusSeeds = [
      { user: "Sarah Chen", text: "New design system is live! 🎉 Check the prototype in the group.", bg: "#7c2d12" },
      { user: "Marcus Webb", text: "Shipped v2.4 overnight ⚡ Zero downtime deploy.", bg: "#1e3a8a" },
      { user: "Priya Sharma", text: "Q3 campaign results are in 📈 +212% engagement!", bg: "#831843" },
      { user: "PingPro Team", text: "🔒 Every message here is end-to-end encrypted. Not even we can read them.", bg: "#008069" },
    ];
    for (const s of statusSeeds) {
      const u = byName.get(s.user);
      if (!u) continue;
      await db.insert(statuses).values({
        userId: u.id,
        textContent: s.text,
        bgColor: s.bg,
        expiresAt: new Date(Date.now() + 20 * 3600 * 1000),
      });
    }

    // group among demos
    const groupMembers = allUsers.filter((u) => u.name !== "PingPro Team").slice(0, 4);
    if (groupMembers.length >= 3) {
      const [group] = await db
        .insert(conversations)
        .values({
          isGroup: true,
          name: "Product Launch 🚀",
          description: "Cross-functional launch squad",
          avatarColor: "#6b21a8",
          createdBy: groupMembers[0].id,
        })
        .returning();
      await db.insert(participants).values(
        groupMembers.map((m, i) => ({
          conversationId: group.id,
          userId: m.id,
          role: i === 0 ? "admin" : "member",
        }))
      );
      const welcomeTexts = [
        { from: groupMembers[0], text: "Welcome to the launch squad! 🎯 Let's ship something amazing." },
        { from: groupMembers[1], text: "Design mocks are ready — sharing the prototype link tomorrow morning." },
        { from: groupMembers[2], text: "Backend is scaled and ready. Load tests passed at 10x traffic ✅" },
      ];
      for (const w of welcomeTexts) {
        const env = plainEnvelope(w.text);
        await db.insert(messages).values({
          conversationId: group.id,
          senderId: w.from.id,
          ciphertext: env.ciphertext,
          iv: env.iv,
          encryptedKeys: env.encryptedKeys,
          messageType: "text",
        });
      }
    }

    // sample calls (need at least 2 users)
    if (allUsers.length >= 2) {
      const a = allUsers[1];
      const b = allUsers[2];
      await db.insert(calls).values([
        { callerId: a.id, receiverId: b.id, type: "voice", status: "outgoing", durationSec: 184 },
        { callerId: b.id, receiverId: a.id, type: "video", status: "missed", durationSec: 0 },
      ]);
    }

    void team;
    return NextResponse.json({ ok: true, users: allUsers.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "seed failed" }, { status: 500 });
  }
}

export async function GET() {
  const rows = await db.select().from(users);
  return NextResponse.json({ count: rows.length });
}
