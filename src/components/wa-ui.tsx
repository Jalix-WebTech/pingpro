"use client";

import { Check, CheckCheck, Users } from "lucide-react";
import { cn } from "@/lib/cn";

// ---------- Types ----------
export type User = {
  id: string;
  name: string;
  phone: string;
  about: string;
  avatarColor: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
};

export type Member = {
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  lastReadAt: string;
  user: User | null;
};

export type Conversation = {
  id: string;
  isGroup: boolean;
  name: string | null;
  description: string | null;
  avatarColor: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationFull = Conversation & {
  members: Member[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastMessage: any | null;
  unread: number;
};

export type RawMessage = {
  id: string;
  conversationId: string;
  senderId: string | null;
  ciphertext: string;
  iv: string;
  encryptedKeys: Record<string, string>;
  messageType: string;
  replyToId: string | null;
  createdAt: string;
};

export type StatusItem = {
  id: string;
  userId: string;
  textContent: string;
  bgColor: string;
  createdAt: string;
  expiresAt: string;
  user: User | null;
};

export type CallItem = {
  id: string;
  callerId: string;
  receiverId: string;
  type: string;
  status: string;
  durationSec: number;
  createdAt: string;
  caller: User | null;
  receiver: User | null;
};

export type Session = { user: User; privateJwk: JsonWebKey };

// ---------- Helpers ----------
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "Yesterday";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
}

export function formatDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "TODAY";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "YESTERDAY";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

export function formatLastSeen(iso: string, isOnline: boolean): string {
  if (isOnline) return "online";
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "last seen just now";
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `last seen today at ${formatMsgTime(iso)}`;
  return `last seen ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDuration(sec: number): string {
  if (sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

export function dmPeer(conv: ConversationFull, myId: string): User | null {
  if (conv.isGroup) return null;
  const m = conv.members.find((x) => x.userId !== myId);
  return m?.user ?? null;
}

export function convDisplayName(conv: ConversationFull, myId: string): string {
  if (conv.isGroup) return conv.name || "Group";
  return dmPeer(conv, myId)?.name || "Unknown";
}

export const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅",
  "😭", "😡", "👍", "👎", "🙏", "👏", "💪", "🔥", "❤️", "💔",
  "🎉", "✅", "❌", "⭐", "🚀", "💡", "📎", "📷", "🎤", "☕",
  "🍕", "⚽", "✈️", "💼", "📅", "🔒", "💯", "🥳", "😴", "🤝",
];

export const STATUS_COLORS = ["#008069", "#7c2d12", "#1e3a8a", "#831843", "#065f46", "#581c87", "#b45309", "#0e7490"];

// ---------- Bits ----------
export function Avatar({
  name,
  color,
  size = 48,
  isGroup,
  online,
}: {
  name: string;
  color: string;
  size?: number;
  isGroup?: boolean;
  online?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
        style={{ backgroundColor: color, fontSize: size * 0.36 }}
      >
        {isGroup ? <Users style={{ width: size * 0.48, height: size * 0.48 }} /> : initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-[#111b21]",
            online ? "bg-[#00a884]" : "bg-gray-400"
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

export function Ticks({ state }: { state: "sent" | "delivered" | "read" }) {
  if (state === "sent") return <Check className="h-4 w-4 text-[#8696a0]" />;
  return (
    <CheckCheck className={cn("h-4 w-4", state === "read" ? "text-[#53bdeb]" : "text-[#8696a0]")} />
  );
}

export function EncryptionBadge({ dark }: { dark?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-[92%] items-start gap-1.5 rounded-lg px-3 py-1.5 text-center text-[11px] leading-snug shadow-sm",
        dark ? "bg-[#182229] text-[#ffd279]" : "bg-[#fdf3c6] text-[#54656f]"
      )}
    >
      <span className="mt-px">🔒</span>
      <span>
        Messages are end-to-end encrypted. No one outside of this chat, not even PingPro, can
        read or listen to them.
      </span>
    </div>
  );
}
