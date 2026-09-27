"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, MoreVertical, Plus, Camera, Phone, Video, Mic, Send, Smile,
  Paperclip, ChevronLeft, ChevronRight, Users, User, X, Moon, Sun, LogOut,
  Image as ImageIcon, ArrowLeft, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Lock, Pencil, Trash2, Copy, Reply, MessageCircle, UserPlus, Clock,
  PhoneMissed, PhoneIncoming, PhoneOutgoing, Wifi, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Avatar, Ticks, EncryptionBadge, EMOJIS, STATUS_COLORS,
  initials, formatMsgTime, formatListTime, formatDivider, formatLastSeen,
  timeAgo, formatDuration, dmPeer, convDisplayName,
  type User as WAUser, type ConversationFull, type RawMessage,
  type Member, type StatusItem, type CallItem, type Session,
} from "./wa-ui";
import {
  generateIdentityKeyPair, exportPublicKeyB64, exportPrivateKeyJwk,
  importPublicKeyB64, importPrivateKeyJwk, encryptForRecipients,
  decryptEnvelope, keyFingerprint, savePrivateKeyLocal, loadPrivateKeyLocal,
} from "@/lib/e2ee";

// ============================== helpers ==============================
type Decrypted = { ok: boolean; text: string; kind: string };

async function decryptOne(
  msg: RawMessage, myId: string, priv: CryptoKey | null
): Promise<Decrypted> {
  try {
    if (msg.iv === "PLAIN") {
      const bin = atob(msg.ciphertext);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
        text: string; kind?: string;
      };
      return { ok: true, text: parsed.text, kind: parsed.kind || "text" };
    }
    if (!priv) return { ok: false, text: "", kind: "text" };
    const body = await decryptEnvelope(
      { ciphertext: msg.ciphertext, iv: msg.iv, keys: msg.encryptedKeys },
      myId, priv
    );
    return { ok: true, text: body.text, kind: body.kind || "text" };
  } catch {
    return { ok: false, text: "", kind: "text" };
  }
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const h = now.getHours() % 12 || 12;
  return `${h}:${now.getMinutes().toString().padStart(2, "0")}`;
}

// ============================== AUTH ==============================
function AuthScreen({
  users, loading, creating, seeding, error, onCreate, onQuickLogin, onSeed,
}: {
  users: WAUser[];
  loading: boolean;
  creating: boolean;
  seeding: boolean;
  error: string | null;
  onCreate: (name: string, phone: string) => void;
  onQuickLogin: (u: WAUser) => void;
  onSeed: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div className="flex h-full flex-col overflow-y-auto wa-scroll bg-white dark:bg-[#0b141a]">
      <div className="bg-[#008069] px-6 pb-8 pt-10 text-white">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <MessageCircle className="h-9 w-9" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">PingPro</h1>
          <p className="mt-1 text-[13px] text-emerald-50">
            Professional messenger with real-time, end-to-end encrypted chats
          </p>
          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-[11px]">
            <Lock className="h-3 w-3" /> RSA-2048 + AES-256-GCM · keys stay on your device
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm flex-1 px-5 py-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111b21]">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
            Create your encrypted profile
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-[#8696a0]">
            A private encryption key is generated on this device.
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-[#aebac1]">
            Display name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Morgan"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20 dark:border-white/10 dark:bg-[#202c33] dark:text-white"
          />
          <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-[#aebac1]">
            Phone number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 1234"
            inputMode="tel"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20 dark:border-white/10 dark:bg-[#202c33] dark:text-white"
          />
          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            disabled={creating || !name.trim() || !phone.trim()}
            onClick={() => onCreate(name.trim(), phone.trim())}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#008069] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#006b57] disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            {creating ? "Generating keys…" : "Generate keys & continue"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111b21]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              Quick sign-in
            </h2>
            <button
              onClick={onSeed}
              disabled={seeding}
              className="rounded-full bg-[#008069]/10 px-3 py-1 text-[11px] font-semibold text-[#008069] hover:bg-[#008069]/20 disabled:opacity-50 dark:text-[#00a884]"
            >
              {seeding ? "Loading…" : users.length === 0 ? "✨ Load demo team" : "Refresh team"}
            </button>
          </div>
          {loading ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-[#8696a0]">Loading team…</p>
          ) : users.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-[#8696a0]">
              No accounts yet. Create one above, or tap{" "}
              <span className="font-semibold">“Load demo team”</span> to seed a professional
              workspace with colleagues, a launch group and statuses.
            </p>
          ) : (
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto wa-scroll">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onQuickLogin(u)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <Avatar name={u.name} color={u.avatarColor} size={40} online={u.isOnline} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                      {u.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-[#8696a0]">
                      {u.phone} · {u.about.slice(0, 32)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-[#8696a0]" />
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-400 dark:text-[#8696a0]">
          🔒 Private keys never leave this device. Signing in on a new device rotates your key —
          older messages may become unreadable there.
        </p>
      </div>
    </div>
  );
}

// ============================== MAIN APP ==============================
export default function WhatsAppApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [privKey, setPrivKey] = useState<CryptoKey | null>(null);
  const privRef = useRef<CryptoKey | null>(null);

  const [users, setUsers] = useState<WAUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationFull[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
  const [decrypted, setDecrypted] = useState<Map<string, Decrypted>>(new Map());
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  const [tab, setTab] = useState<"chats" | "status" | "calls">("chats");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<RawMessage | null>(null);
  const [msgMenu, setMsgMenu] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [presence, setPresence] = useState<Record<string, { isOnline: boolean; lastSeen: string }>>({});
  const [typingMap, setTypingMap] = useState<Record<string, { userName: string; at: number }>>({});
  const [unreadLocal, setUnreadLocal] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<{ id: number; title: string; body: string }[]>([]);

  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewStatus, setShowNewStatus] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [viewerImg, setViewerImg] = useState<string | null>(null);
  const [statusViewer, setStatusViewer] = useState<{ userId: string; idx: number } | null>(null);
  const [activeCall, setActiveCall] = useState<{
    peer: WAUser; type: string; outgoing: boolean; startedAt: number;
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ call: CallItem } | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const pubCache = useRef(new Map<string, CryptoKey>());
  const toastId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const typingThrottle = useRef(0);
  const clock = useClock();

  const me = session?.user ?? null;
  const myId = me?.id ?? "";

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    privRef.current = privKey;
  }, [privKey]);

  const pushToast = useCallback((title: string, body: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // ---------- fetchers ----------
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const r = await fetch("/api/users");
      const j = await r.json();
      if (j.users) setUsers(j.users);
    } catch {
      // ignore
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchConversations = useCallback(async (uid: string) => {
    setConvLoading(true);
    try {
      const r = await fetch(`/api/conversations?userId=${uid}`);
      const j = await r.json();
      if (j.conversations) setConversations(j.conversations);
    } catch {
      // ignore
    } finally {
      setConvLoading(false);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      const r = await fetch("/api/statuses");
      const j = await r.json();
      if (j.statuses) setStatuses(j.statuses);
    } catch {
      // ignore
    }
  }, []);

  const fetchCalls = useCallback(async (uid: string) => {
    try {
      const r = await fetch(`/api/calls?userId=${uid}`);
      const j = await r.json();
      if (j.calls) setCalls(j.calls);
    } catch {
      // ignore
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string, uid: string) => {
    setMsgsLoading(true);
    try {
      const r = await fetch(`/api/conversations/${convId}/messages?userId=${uid}&limit=300`);
      const j = await r.json();
      if (j.messages) {
        setRawMessages(j.messages);
        setDecrypted(new Map());
      }
      if (j.members) setActiveMembers(j.members);
    } catch {
      // ignore
    } finally {
      setMsgsLoading(false);
    }
  }, []);

  const markRead = useCallback(async (convId: string, uid: string) => {
    try {
      await fetch(`/api/conversations/${convId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
    } catch {
      // ignore
    }
  }, []);

  // ---------- boot: restore session ----------
  useEffect(() => {
    (async () => {
      try {
        await fetchUsers();
        const raw = localStorage.getItem("pingpro_session");
        if (raw) {
          const { userId } = JSON.parse(raw) as { userId: string };
          const jwk = loadPrivateKeyLocal(userId);
          if (jwk) {
            const res = await fetch(`/api/users/${userId}`);
            const j = await res.json();
            if (j.user) {
              const priv = await importPrivateKeyJwk(jwk);
              setPrivKey(priv);
              setSession({ user: j.user, privateJwk: jwk });
              await fetch(`/api/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isOnline: true }),
              }).catch(() => {});
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- after login: load data ----------
  useEffect(() => {
    if (!me) return;
    fetchConversations(myId);
    fetchStatuses();
    fetchCalls(myId);
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // ---------- realtime SSE ----------
  useEffect(() => {
    if (!me) return;
    const es = new EventSource(`/api/realtime/subscribe?userId=${myId}`);
    es.onmessage = async (ev) => {
      try {
        const evt = JSON.parse(ev.data) as { type: string; payload: Record<string, never> };
        if (evt.type === "message:new") {
          const { conversationId, message } = evt.payload as unknown as {
            conversationId: string; message: RawMessage;
          };
          if (activeIdRef.current === conversationId) {
            setRawMessages((prev) =>
              prev.some((m) => m.id === message.id) ? prev : [...prev, message]
            );
            markRead(conversationId, myId);
          } else {
            setUnreadLocal((u) => ({ ...u, [conversationId]: (u[conversationId] || 0) + 1 }));
            const d = await decryptOne(message, myId, privRef.current);
            const conv = conversationsRef.current.find((c) => c.id === conversationId);
            const sender = conv?.members.find((m) => m.userId === message.senderId)?.user;
            pushToast(
              sender ? `${sender.name}` : "New message",
              d.ok ? (d.kind === "image" ? "📷 Photo" : d.text.slice(0, 80)) : "🔒 New encrypted message"
            );
          }
          fetchConversations(myId);
        } else if (evt.type === "typing") {
          const { conversationId, userName, isTyping, userId } = evt.payload as unknown as {
            conversationId: string; userName: string; isTyping: boolean; userId: string;
          };
          if (userId === myId) return;
          setTypingMap((m) => {
            const next = { ...m };
            if (isTyping) next[conversationId] = { userName, at: Date.now() };
            else delete next[conversationId];
            return next;
          });
        } else if (evt.type === "presence") {
          const { userId, isOnline, lastSeen } = evt.payload as unknown as {
            userId: string; isOnline: boolean; lastSeen: string;
          };
          if (!userId) return;
          setPresence((p) => ({ ...p, [userId]: { isOnline, lastSeen } }));
          setUsers((us) =>
            us.map((u) => (u.id === userId ? { ...u, isOnline, lastSeen } : u))
          );
          setActiveMembers((ms) =>
            ms.map((m) =>
              m.userId === userId && m.user ? { ...m, user: { ...m.user, isOnline, lastSeen } } : m
            )
          );
        } else if (evt.type === "conversation:new" || evt.type === "conversation:updated") {
          fetchConversations(myId);
          const { conversationId } = evt.payload as unknown as { conversationId: string };
          if (conversationId && activeIdRef.current === conversationId) {
            const r = await fetch(`/api/conversations/${conversationId}`);
            const j = await r.json().catch(() => null);
            if (j?.members) setActiveMembers(j.members);
          }
        } else if (evt.type === "message:read") {
          const { conversationId, userId, lastReadAt } = evt.payload as unknown as {
            conversationId: string; userId: string; lastReadAt: string;
          };
          if (conversationId === activeIdRef.current) {
            setActiveMembers((ms) =>
              ms.map((m) => (m.userId === userId ? { ...m, lastReadAt } : m))
            );
          }
        } else if (evt.type === "message:deleted") {
          const { conversationId, messageId } = evt.payload as unknown as {
            conversationId: string; messageId: string;
          };
          if (conversationId === activeIdRef.current) {
            setRawMessages((prev) => prev.filter((m) => m.id !== messageId));
          }
          fetchConversations(myId);
        } else if (evt.type === "status:new") {
          fetchStatuses();
        } else if (evt.type === "call:new") {
          fetchCalls(myId);
          const { call } = evt.payload as unknown as { call: CallItem };
          if (call && call.receiverId === myId && call.callerId !== myId) {
            const caller = usersRef.current.find((u) => u.id === call.callerId);
            setIncomingCall({
              call: { ...call, caller: caller ?? call.caller ?? null, receiver: null },
            });
          }
        }
      } catch {
        // ignore malformed
      }
    };
    es.onerror = () => {
      // EventSource auto-retries
    };
    // presence heartbeat
    const hb = setInterval(() => {
      fetch("/api/realtime/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "presence", userId: myId, isOnline: true }),
      }).catch(() => {});
    }, 25000);
    const onUnload = () => {
      navigator.sendBeacon?.(
        "/api/realtime/event",
        JSON.stringify({ kind: "presence", userId: myId, isOnline: false })
      );
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      es.close();
      clearInterval(hb);
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const conversationsRef = useRef<ConversationFull[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const usersRef = useRef<WAUser[]>([]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // typing cleanup
  useEffect(() => {
    const t = setInterval(() => {
      setTypingMap((m) => {
        const now = Date.now();
        const next: typeof m = {};
        for (const [k, v] of Object.entries(m)) {
          if (now - v.at < 5000) next[k] = v;
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // ---------- decrypt active messages ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = rawMessages.filter((m) => !decrypted.has(m.id));
      if (missing.length === 0) return;
      const entries: [string, Decrypted][] = [];
      for (const m of missing.slice(0, 120)) {
        const d = await decryptOne(m, myId, privKey);
        entries.push([m.id, d]);
      }
      if (!cancelled && entries.length) {
        setDecrypted((prev) => {
          const next = new Map(prev);
          for (const [id, d] of entries) next.set(id, d);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMessages, privKey, myId]);

  // ---------- decrypt list previews ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const c of conversations) {
        if (!c.lastMessage || previews.has(c.id + c.lastMessage.id)) continue;
        const d = await decryptOne(c.lastMessage as RawMessage, myId, privKey);
        if (cancelled) return;
        const label = !d.ok
          ? "🔒 Encrypted message"
          : d.kind === "image"
            ? "📷 Photo"
            : d.text;
        setPreviews((p) => new Map(p).set(c.id + (c.lastMessage as RawMessage).id, label));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, privKey, myId]);

  // scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rawMessages.length, decrypted.size, activeId, typingMap]);

  // ---------- auth actions ----------
  const handleCreate = async (name: string, phone: string) => {
    setCreating(true);
    setAuthError(null);
    try {
      const pair = await generateIdentityKeyPair();
      const pubB64 = await exportPublicKeyB64(pair.publicKey);
      const jwk = await exportPrivateKeyJwk(pair.privateKey);
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, publicKey: pubB64 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not create profile");
      savePrivateKeyLocal(j.user.id, jwk);
      localStorage.setItem("pingpro_session", JSON.stringify({ userId: j.user.id }));
      const priv = await importPrivateKeyJwk(jwk);
      setPrivKey(priv);
      setSession({ user: j.user, privateJwk: jwk });
      pushToast("Welcome to PingPro 🔒", "Your encryption keys were generated on this device.");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleQuickLogin = async (u: WAUser) => {
    setAuthError(null);
    try {
      let jwk = loadPrivateKeyLocal(u.id);
      if (!jwk) {
        // new device: rotate key
        const pair = await generateIdentityKeyPair();
        const pubB64 = await exportPublicKeyB64(pair.publicKey);
        jwk = await exportPrivateKeyJwk(pair.privateKey);
        await fetch(`/api/users/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: pubB64, isOnline: true }),
        });
        savePrivateKeyLocal(u.id, jwk);
        pushToast("New device detected", "Encryption key rotated — older messages may be unreadable here.");
      } else {
        await fetch(`/api/users/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOnline: true }),
        }).catch(() => {});
      }
      const res = await fetch(`/api/users/${u.id}`);
      const j = await res.json();
      localStorage.setItem("pingpro_session", JSON.stringify({ userId: u.id }));
      const priv = await importPrivateKeyJwk(jwk);
      setPrivKey(priv);
      setSession({ user: j.user ?? u, privateJwk: jwk });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Login failed");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      await fetchUsers();
      pushToast("Demo workspace ready ✨", "Team, launch group and statuses were loaded.");
    } catch {
      // ignore
    } finally {
      setSeeding(false);
    }
  };

  const handleLogout = async () => {
    if (me) {
      fetch("/api/realtime/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "presence", userId: myId, isOnline: false }),
      }).catch(() => {});
    }
    localStorage.removeItem("pingpro_session");
    setSession(null);
    setPrivKey(null);
    setActiveId(null);
    setRawMessages([]);
    setConversations([]);
    setMenuOpen(false);
  };

  // ---------- chat actions ----------
  const openConversation = (id: string) => {
    setActiveId(id);
    setReplyTo(null);
    setShowEmoji(false);
    setMsgMenu(null);
    setUnreadLocal((u) => {
      const n = { ...u };
      delete n[id];
      return n;
    });
    if (me) {
      fetchMessages(id, myId);
      markRead(id, myId);
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (!activeId || !me) return;
    const now = Date.now();
    if (isTyping && now - typingThrottle.current < 2500) return;
    typingThrottle.current = now;
    fetch("/api/realtime/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "typing", conversationId: activeId, userId: myId,
        userName: me.name, isTyping,
      }),
    }).catch(() => {});
  };

  const handleSend = async (kind: "text" | "image" = "text", imageData?: string) => {
    const text = kind === "image" ? (imageData || "") : input.trim();
    if (!text || !activeId || !me || sending) return;
    setSending(true);
    try {
      const pubs = new Map<string, CryptoKey>();
      for (const m of activeMembers) {
        const kb64 = m.user?.publicKey;
        if (!kb64) continue;
        try {
          let k = pubCache.current.get(m.userId);
          if (!k) {
            k = await importPublicKeyB64(kb64);
            pubCache.current.set(m.userId, k);
          }
          pubs.set(m.userId, k);
        } catch {
          // skip undecryptable member
        }
      }
      if (!pubs.has(myId) && me.publicKey) {
        try {
          let k = pubCache.current.get(myId);
          if (!k) {
            k = await importPublicKeyB64(me.publicKey);
            pubCache.current.set(myId, k);
          }
          pubs.set(myId, k);
        } catch {
          // ignore
        }
      }
      if (pubs.size === 0) throw new Error("No valid recipient keys");
      const replyPreview = replyTo
        ? (decrypted.get(replyTo.id)?.text || "").slice(0, 120)
        : undefined;
      const env = await encryptForRecipients(
        { text, kind, replyPreview, sentAt: Date.now() },
        pubs
      );
      const r = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: myId,
          ciphertext: env.ciphertext,
          iv: env.iv,
          encryptedKeys: env.keys,
          messageType: kind,
          replyToId: replyTo?.id ?? null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Send failed");
      setRawMessages((prev) =>
        prev.some((m) => m.id === j.message.id) ? prev : [...prev, j.message]
      );
      setInput("");
      setReplyTo(null);
      setShowEmoji(false);
      sendTyping(false);
      fetchConversations(myId);
    } catch (e) {
      pushToast("Couldn't send", e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleAttach = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 1_200_000) {
      pushToast("Image too large", "Please choose an image under ~1MB (it gets encrypted).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // downscale to max 900px
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          handleSend("image", dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        handleSend("image", canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => handleSend("image", dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  };

  const handleDelete = async (msgId: string) => {
    if (!activeId) return;
    setMsgMenu(null);
    try {
      await fetch(`/api/conversations/${activeId}/messages?messageId=${msgId}&userId=${myId}`, {
        method: "DELETE",
      });
      setRawMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      // ignore
    }
  };

  const startDm = async (otherId: string) => {
    try {
      const r = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: myId, memberIds: [otherId], isGroup: false }),
      });
      const j = await r.json();
      if (j.conversation) {
        setShowNewChat(false);
        await fetchConversations(myId);
        openConversation(j.conversation.id);
      }
    } catch {
      // ignore
    }
  };

  const startCall = async (peer: WAUser, type: "voice" | "video") => {
    setActiveCall({ peer, type, outgoing: true, startedAt: Date.now() });
    try {
      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId: myId, receiverId: peer.id, type,
          status: "outgoing", durationSec: 0,
        }),
      });
      fetchCalls(myId);
    } catch {
      // ignore
    }
  };

  // ---------- derived ----------
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = conversations.map((c) => {
      const lastId = c.lastMessage ? c.id + (c.lastMessage as RawMessage).id : c.id;
      return {
        c,
        preview: c.lastMessage ? previews.get(lastId) || "…" : "No messages yet",
        unread: (c.unread || 0) + (unreadLocal[c.id] || 0),
      };
    });
    if (!q) return list;
    return list.filter(({ c, preview }) =>
      convDisplayName(c, myId).toLowerCase().includes(q) ||
      preview.toLowerCase().includes(q)
    );
  }, [conversations, previews, search, myId, unreadLocal]);

  const totalUnread = useMemo(
    () => filteredConvs.reduce((a, x) => a + x.unread, 0),
    [filteredConvs]
  );

  const groupedMsgs = useMemo(() => {
    const groups: { day: string; items: RawMessage[] }[] = [];
    for (const m of rawMessages) {
      const day = formatDivider(m.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [rawMessages]);

  const statusGroups = useMemo(() => {
    const now = Date.now();
    const valid = statuses.filter((s) => new Date(s.expiresAt).getTime() > now);
    const map = new Map<string, { user: WAUser | null; items: StatusItem[] }>();
    for (const s of valid) {
      const g = map.get(s.userId) ?? { user: s.user, items: [] };
      g.items.push(s);
      if (!g.user && s.user) g.user = s.user;
      map.set(s.userId, g);
    }
    return Array.from(map.entries()).map(([userId, g]) => ({ userId, ...g }));
  }, [statuses]);

  const myStatuses = statusGroups.find((g) => g.userId === myId);

  const tickFor = (m: RawMessage): "sent" | "delivered" | "read" => {
    if (m.senderId !== myId) return "delivered";
    const others = activeMembers.filter((x) => x.userId !== myId);
    if (others.length === 0) return "sent";
    const mt = new Date(m.createdAt).getTime();
    const allRead = others.every((o) => new Date(o.lastReadAt).getTime() >= mt);
    if (allRead) return "read";
    return Date.now() - mt > 2500 ? "delivered" : "sent";
  };

  const activeTyping = activeId ? typingMap[activeId] : undefined;

  // ============================== render ==============================
  if (booting) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-[#0b141a]">
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#008069]">
            <MessageCircle className="h-9 w-9" />
          </div>
          <p className="text-sm text-[#8696a0]">Loading encrypted workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b141a] lg:flex lg:items-center lg:justify-center lg:gap-12 lg:p-6">
      {/* Marketing panel (desktop) */}
      <div className="hidden max-w-md flex-col gap-6 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#008069]">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xl font-bold">PingPro</p>
            <p className="text-xs text-[#8696a0]">Encrypted professional messenger</p>
          </div>
        </div>
        <h1 className="text-4xl font-bold leading-tight">
          WhatsApp-simple.
          <br />
          <span className="text-[#00a884]">Boardroom-secure.</span>
        </h1>
        <p className="text-sm leading-relaxed text-[#aebac1]">
          Real-time chats, groups, statuses and calls — wrapped in true end-to-end
          encryption. Message keys are generated per message and only recipients can unwrap
          them.
        </p>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          {[
            ["⚡", "Realtime delivery", "Live SSE sync, typing & presence"],
            ["🔒", "Hybrid E2EE", "RSA-2048 wraps AES-256-GCM keys"],
            ["👥", "Groups & DMs", "Launch squads, replies, receipts"],
            ["📞", "Calls & status", "Voice/video log + 24h updates"],
          ].map(([e, t, d]) => (
            <div key={t} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-lg">{e}</p>
              <p className="mt-1 font-semibold">{t}</p>
              <p className="text-xs text-[#8696a0]">{d}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-[#008069]/15 p-4 ring-1 ring-[#00a884]/30">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#00a884]">
            <ShieldCheck className="h-4 w-4" /> Zero-knowledge server
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#aebac1]">
            This server stores only ciphertext and wrapped keys. Open any conversation →
            contact info → <span className="font-semibold">Encryption</span> to verify safety
            numbers, just like a security audit.
          </p>
        </div>
      </div>

      {/* Phone frame */}
      <div className={cn(dark && "dark")}>
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#efeae2] dark:bg-[#0b141a] sm:mx-auto sm:h-[92vh] sm:w-[430px] sm:rounded-[2.4rem] sm:border-[10px] sm:border-black sm:shadow-2xl">
          {/* status bar */}
          <div className="z-30 flex items-center justify-between bg-[#008069] px-6 pb-1 pt-3 text-[12px] font-semibold text-white">
            <span>{clock}</span>
            <span className="flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              <span className="text-[10px]">5G</span>
              <span className="inline-block h-3 w-6 rounded-[4px] border border-white/80 p-[1.5px]">
                <span className="block h-full w-4/5 rounded-[2px] bg-white" />
              </span>
            </span>
          </div>

          {!me ? (
            <div className="flex-1 overflow-hidden">
              <AuthScreen
                users={users}
                loading={usersLoading}
                creating={creating}
                seeding={seeding}
                error={authError}
                onCreate={handleCreate}
                onQuickLogin={handleQuickLogin}
                onSeed={handleSeed}
              />
            </div>
          ) : activeId && activeConv ? (
            /* ================= CHAT VIEW ================= */
            <ChatPane
              key={activeId}
              me={me}
              conv={activeConv}
              members={activeMembers}
              grouped={groupedMsgs}
              decrypted={decrypted}
              rawById={new Map(rawMessages.map((m) => [m.id, m]))}
              msgsLoading={msgsLoading}
              input={input}
              setInput={(v) => {
                setInput(v);
                sendTyping(true);
              }}
              onSend={() => handleSend()}
              onAttach={handleAttach}
              sending={sending}
              showEmoji={showEmoji}
              setShowEmoji={setShowEmoji}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              msgMenu={msgMenu}
              setMsgMenu={setMsgMenu}
              onDelete={handleDelete}
              onBack={() => {
                sendTyping(false);
                setActiveId(null);
                fetchConversations(myId);
              }}
              onOpenContact={() => setShowContact(true)}
              onCall={(t) => {
                const peer = activeConv.isGroup
                  ? null
                  : dmPeer(activeConv, myId);
                if (peer) startCall(peer, t);
                else pushToast("Group calls", "Pick a member from group info to call them.");
              }}
              tickFor={tickFor}
              typing={activeTyping}
              msgEndRef={msgEndRef}
              onImage={(src) => setViewerImg(src)}
              pushToast={pushToast}
            />
          ) : (
            /* ================= MAIN (list) VIEW ================= */
            <div className="flex h-full min-h-0 flex-1 flex-col">
              {/* header */}
              <div className="bg-[#008069] px-4 pb-2 pt-1 text-white">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowProfile(true)}
                    className="flex items-center gap-2.5"
                    title="My profile"
                  >
                    <Avatar name={me.name} color={me.avatarColor} size={36} />
                    <span className="text-left">
                      <span className="block text-[17px] font-semibold leading-tight">
                        PingPro
                      </span>
                      <span className="block text-[11px] text-emerald-100/90">
                        🔒 end-to-end encrypted
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setShowNewStatus(true)} title="New status">
                      <Camera className="h-5 w-5" />
                    </button>
                    <button onClick={() => setSearchOpen((s) => !s)} title="Search">
                      <Search className="h-5 w-5" />
                    </button>
                    <div className="relative">
                      <button onClick={() => setMenuOpen((m) => !m)} title="Menu">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-8 z-50 w-48 overflow-hidden rounded-xl bg-white text-sm text-gray-800 shadow-xl dark:bg-[#23333d] dark:text-white">
                          {[
                            ["New group", () => { setShowNewGroup(true); setMenuOpen(false); }],
                            ["New status", () => { setShowNewStatus(true); setMenuOpen(false); }],
                            ["My profile", () => { setShowProfile(true); setMenuOpen(false); }],
                            [dark ? "Light mode" : "Dark mode", () => { setDark((d) => !d); setMenuOpen(false); }],
                            ["Log out", handleLogout],
                          ].map(([label, fn]) => (
                            <button
                              key={label as string}
                              onClick={fn as () => void}
                              className="block w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10"
                            >
                              {label as string}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* tabs */}
                <div className="mt-2 flex items-center gap-6 text-[14px] font-semibold">
                  {(
                    [
                      ["chats", "CHATS"],
                      ["status", "STATUS"],
                      ["calls", "CALLS"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={cn(
                        "relative flex-1 pb-2 text-center tracking-wide",
                        tab === key ? "text-white" : "text-emerald-100/70"
                      )}
                    >
                      {label}
                      {key === "chats" && totalUnread > 0 && (
                        <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#008069]">
                          {totalUnread}
                        </span>
                      )}
                      {tab === key && (
                        <span className="absolute inset-x-6 -bottom-0 h-[3px] rounded-full bg-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {searchOpen && (
                <div className="bg-[#008069] px-4 pb-3">
                  <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 dark:bg-[#202c33]">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search chats…"
                      className="w-full bg-transparent text-sm outline-none dark:text-white"
                    />
                    {search && (
                      <button onClick={() => setSearch("")}>
                        <X className="h-4 w-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* body */}
              <div className="min-h-0 flex-1 overflow-hidden bg-white dark:bg-[#0b141a]">
                {tab === "chats" && (
                  <div className="flex h-full flex-col">
                    {!searchOpen && (
                      <div className="px-3 pt-2">
                        <button
                          onClick={() => setSearchOpen(true)}
                          className="flex w-full items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-[#202c33] dark:text-[#8696a0]"
                        >
                          <Search className="h-4 w-4" /> Search
                        </button>
                      </div>
                    )}
                    <div className="mt-1 min-h-0 flex-1 overflow-y-auto wa-scroll">
                      {convLoading && conversations.length === 0 ? (
                        <p className="p-6 text-center text-sm text-gray-400">
                          Loading chats…
                        </p>
                      ) : filteredConvs.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#008069]/10">
                            <MessageCircle className="h-8 w-8 text-[#008069]" />
                          </div>
                          <p className="text-sm font-semibold dark:text-white">No chats yet</p>
                          <p className="text-xs text-gray-500 dark:text-[#8696a0]">
                            Tap + to message a colleague or start a group.
                          </p>
                        </div>
                      ) : (
                        filteredConvs.map(({ c, preview, unread }) => {
                          const peer = dmPeer(c, myId);
                          const name = convDisplayName(c, myId);
                          const color = c.isGroup ? c.avatarColor : peer?.avatarColor || "#008069";
                          const t = typingMap[c.id];
                          const online = peer
                            ? presence[peer.id]?.isOnline ?? peer.isOnline
                            : false;
                          const last = c.lastMessage as RawMessage | null;
                          const mine = last?.senderId === myId;
                          return (
                            <button
                              key={c.id}
                              onClick={() => {
                                setTab("chats");
                                openConversation(c.id);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-white/5"
                            >
                              <Avatar
                                name={name}
                                color={color}
                                size={52}
                                isGroup={c.isGroup}
                                online={c.isGroup ? undefined : online}
                              />
                              <span className="min-w-0 flex-1 border-b border-gray-100 pb-2.5 dark:border-white/5">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-[15px] font-medium text-gray-900 dark:text-white">
                                    {name}
                                  </span>
                                  {last && (
                                    <span
                                      className={cn(
                                        "shrink-0 text-[11px]",
                                        unread > 0
                                          ? "font-semibold text-[#00a884]"
                                          : "text-gray-400 dark:text-[#8696a0]"
                                      )}
                                    >
                                      {formatListTime(last.createdAt)}
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                  <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] text-gray-500 dark:text-[#8696a0]">
                                    {t && Date.now() - t.at < 5000 ? (
                                      <span className="truncate font-medium text-[#00a884]">
                                        typing…
                                      </span>
                                    ) : (
                                      <>
                                        {mine && last && (
                                          <Ticks
                                            state={
                                              (c.members || []).filter(
                                                (m) =>
                                                  m.userId !== myId &&
                                                  new Date(m.lastReadAt).getTime() >=
                                                    new Date(last.createdAt).getTime()
                                              ).length ===
                                              (c.members || []).filter((m) => m.userId !== myId).length &&
                                              (c.members || []).filter((m) => m.userId !== myId).length > 0
                                                ? "read"
                                                : "delivered"
                                            }
                                          />
                                        )}
                                        <span className="truncate">
                                          {c.isGroup && last && last.senderId !== myId
                                            ? `${c.members.find((m) => m.userId === last.senderId)?.user?.name.split(" ")[0] || ""}: ${preview}`
                                            : preview}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                  {unread > 0 ? (
                                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#00a884] px-1.5 text-[11px] font-bold text-white">
                                      {unread}
                                    </span>
                                  ) : c.isGroup ? (
                                    <Users className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-[#8696a0]" />
                                  ) : null}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {tab === "status" && (
                  <StatusPane
                    me={me}
                    groups={statusGroups}
                    myStatuses={myStatuses ?? null}
                    onNew={() => setShowNewStatus(true)}
                    onOpen={(userId) => setStatusViewer({ userId, idx: 0 })}
                  />
                )}

                {tab === "calls" && (
                  <CallsPane
                    me={me}
                    calls={calls}
                    users={users}
                    onCall={(peer, type) => startCall(peer, type)}
                  />
                )}
              </div>

              {/* FAB */}
              <div className="pointer-events-none absolute bottom-6 right-5 z-30">
                <button
                  onClick={() => {
                    if (tab === "chats") setShowNewChat(true);
                    else if (tab === "status") setShowNewStatus(true);
                    else setShowNewChat(true);
                  }}
                  className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00a884] text-white shadow-lg transition hover:bg-[#008069]"
                >
                  {tab === "status" ? (
                    <Camera className="h-6 w-6" />
                  ) : tab === "calls" ? (
                    <Phone className="h-6 w-6" />
                  ) : (
                    <MessageCircle className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          {/* toasts */}
          <div className="absolute left-3 right-3 top-14 z-[70] space-y-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="wa-toast-in flex items-start gap-2.5 rounded-2xl bg-[#111b21]/95 p-3 text-white shadow-xl ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#008069]">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{t.title}</p>
                  <p className="truncate text-xs text-white/70">{t.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* modals */}
          {showNewChat && (
            <NewChatModal
              users={users.filter((u) => u.id !== myId)}
              onClose={() => setShowNewChat(false)}
              onPick={(u) => startDm(u.id)}
              onNewGroup={() => {
                setShowNewChat(false);
                setShowNewGroup(true);
              }}
            />
          )}
          {showNewGroup && (
            <NewGroupModal
              users={users.filter((u) => u.id !== myId)}
              onClose={() => setShowNewGroup(false)}
              onCreate={async (gname, ids) => {
                const r = await fetch("/api/conversations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    creatorId: myId, memberIds: ids, isGroup: true, name: gname,
                  }),
                });
                const j = await r.json();
                if (j.conversation) {
                  setShowNewGroup(false);
                  await fetchConversations(myId);
                  openConversation(j.conversation.id);
                }
              }}
            />
          )}
          {showNewStatus && (
            <NewStatusModal
              onClose={() => setShowNewStatus(false)}
              onPost={async (text, color) => {
                await fetch("/api/statuses", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: myId, textContent: text, bgColor: color }),
                });
                setShowNewStatus(false);
                fetchStatuses();
              }}
            />
          )}
          {showProfile && me && (
            <ProfileModal
              me={me}
              onClose={() => setShowProfile(false)}
              onSave={async (name, about) => {
                const r = await fetch(`/api/users/${myId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, about }),
                });
                const j = await r.json();
                if (j.user) {
                  setSession((s) => (s ? { ...s, user: j.user } : s));
                  fetchUsers();
                }
                setShowProfile(false);
              }}
              onVerify={() => {
                setShowProfile(false);
                setShowVerify(true);
              }}
            />
          )}
          {showContact && activeConv && (
            <ContactDrawer
              conv={activeConv}
              myId={myId}
              members={activeMembers}
              users={users}
              images={rawMessages
                .filter((m) => decrypted.get(m.id)?.kind === "image" && decrypted.get(m.id)?.ok)
                .map((m) => decrypted.get(m.id)!.text)}
              onClose={() => setShowContact(false)}
              onVerify={() => {
                setShowContact(false);
                setShowVerify(true);
              }}
              onCall={(peer) => {
                setShowContact(false);
                startCall(peer, "voice");
              }}
              onAddMembers={async (ids) => {
                await fetch(`/api/conversations/${activeConv.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ addMemberIds: ids, requesterId: myId }),
                });
                fetchMessages(activeConv.id, myId);
                fetchConversations(myId);
              }}
              onImage={(src) => setViewerImg(src)}
            />
          )}
          {showVerify && me && (
            <VerifyModal
              me={me}
              members={activeConv ? activeMembers : []}
              isGroup={!!activeConv?.isGroup}
              onClose={() => setShowVerify(false)}
            />
          )}
          {viewerImg && (
            <div
              className="absolute inset-0 z-[80] flex items-center justify-center bg-black/95 p-4"
              onClick={() => setViewerImg(null)}
            >
              <button className="absolute right-4 top-12 text-white">
                <X className="h-7 w-7" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewerImg} alt="attachment" className="max-h-full max-w-full rounded-xl object-contain" />
            </div>
          )}
          {statusViewer && (
            <StatusViewer
              groups={statusGroups}
              userId={statusViewer.userId}
              idx={statusViewer.idx}
              onClose={() => setStatusViewer(null)}
              onNextUser={(uid) => setStatusViewer({ userId: uid, idx: 0 })}
            />
          )}
          {activeCall && (
            <CallOverlay
              peer={activeCall.peer}
              type={activeCall.type}
              outgoing={activeCall.outgoing}
              startedAt={activeCall.startedAt}
              onEnd={() => setActiveCall(null)}
            />
          )}
          {incomingCall && !activeCall && (
            <IncomingCall
              call={incomingCall.call}
              onAccept={() => {
                if (incomingCall.call.caller) {
                  setActiveCall({
                    peer: incomingCall.call.caller,
                    type: incomingCall.call.type,
                    outgoing: false,
                    startedAt: Date.now(),
                  });
                }
                setIncomingCall(null);
              }}
              onDecline={() => {
                setIncomingCall(null);
                pushToast("Call declined", "The caller was notified you are busy.");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================== CHAT PANE ==============================
function ChatPane({
  me, conv, members, grouped, decrypted, rawById, msgsLoading, input, setInput,
  onSend, onAttach, sending, showEmoji, setShowEmoji, replyTo, setReplyTo,
  msgMenu, setMsgMenu, onDelete, onBack, onOpenContact, onCall, tickFor,
  typing, msgEndRef, onImage, pushToast,
}: {
  me: WAUser;
  conv: ConversationFull;
  members: Member[];
  grouped: { day: string; items: RawMessage[] }[];
  decrypted: Map<string, Decrypted>;
  rawById: Map<string, RawMessage>;
  msgsLoading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onAttach: () => void;
  sending: boolean;
  showEmoji: boolean;
  setShowEmoji: React.Dispatch<React.SetStateAction<boolean>>;
  replyTo: RawMessage | null;
  setReplyTo: (m: RawMessage | null) => void;
  msgMenu: string | null;
  setMsgMenu: (id: string | null) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onOpenContact: () => void;
  onCall: (t: "voice" | "video") => void;
  tickFor: (m: RawMessage) => "sent" | "delivered" | "read";
  typing?: { userName: string; at: number };
  msgEndRef: React.RefObject<HTMLDivElement | null>;
  onImage: (src: string) => void;
  pushToast: (t: string, b: string) => void;
}) {
  const peer = dmPeer({ ...conv, members } as ConversationFull, me.id);
  const name = conv.isGroup ? conv.name || "Group" : peer?.name || "Unknown";
  const color = conv.isGroup ? conv.avatarColor : peer?.avatarColor || "#008069";
  const subtitle = typing && Date.now() - typing.at < 5000
    ? "typing…"
    : conv.isGroup
      ? members.map((m) => m.user?.name.split(" ")[0]).filter(Boolean).join(", ")
      : peer
        ? formatLastSeen(peer.lastSeen, peer.isOnline)
        : "";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="z-20 flex items-center gap-1 bg-[#008069] px-1.5 pb-2 pt-1 text-white">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={onOpenContact} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left hover:bg-white/10">
          <Avatar name={name} color={color} size={38} isGroup={conv.isGroup} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight">
              {name}
            </span>
            <span className={cn(
              "block truncate text-[11.5px]",
              typing && Date.now() - typing.at < 5000 ? "font-medium text-white" : "text-emerald-100/90"
            )}>
              {subtitle || "tap for contact info"}
            </span>
          </span>
        </button>
        <button onClick={() => onCall("video")} className="rounded-full p-2 hover:bg-white/10" title="Video call">
          <Video className="h-5 w-5" />
        </button>
        <button onClick={() => onCall("voice")} className="rounded-full p-2 hover:bg-white/10" title="Voice call">
          <Phone className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* messages */}
      <div className="wa-wallpaper dark:wa-wallpaper-dark min-h-0 flex-1 overflow-y-auto wa-scroll px-3 py-3 dark:[color-scheme:dark]">
        <div className="dark:hidden">
          <EncryptionBadge />
        </div>
        <div className="hidden dark:block">
          <EncryptionBadge dark />
        </div>

        {msgsLoading ? (
          <p className="mt-8 text-center text-xs text-[#8696a0]">Decrypting messages…</p>
        ) : grouped.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-sm font-medium text-[#54656f] dark:text-[#aebac1]">
              No messages yet
            </p>
            <p className="text-xs text-[#8696a0]">Say hello — it&apos;s encrypted 🔒</p>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.day}>
              <div className="my-3 flex justify-center">
                <span className="rounded-lg bg-white px-3 py-1 text-[11px] font-medium text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                  {g.day}
                </span>
              </div>
              {g.items.map((m) => {
                const mine = m.senderId === me.id;
                const d = decrypted.get(m.id);
                const sender = members.find((x) => x.userId === m.senderId)?.user;
                const replyRaw = m.replyToId ? rawById.get(m.replyToId) : undefined;
                const replyDec = m.replyToId ? decrypted.get(m.replyToId) : undefined;
                return (
                  <div
                    key={m.id}
                    className={cn("wa-msg-in mb-1.5 flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "relative max-w-[80%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14px] shadow-sm",
                        mine
                          ? "wa-tail-out bg-[#d9fdd3] text-gray-900 dark:bg-[#005c4b] dark:text-white"
                          : "wa-tail-in bg-white text-gray-900 dark:bg-[#1f2c34] dark:text-white"
                      )}
                      style={{ borderTopColor: undefined }}
                    >
                      {conv.isGroup && !mine && (
                        <p
                          className="text-[12px] font-semibold"
                          style={{ color: sender?.avatarColor || "#008069" }}
                        >
                          {sender?.name || "Unknown"}
                        </p>
                      )}
                      {m.replyToId && (
                        <div className="mb-1 overflow-hidden rounded-md border-l-4 border-[#00a884] bg-black/10 px-2 py-1 dark:bg-black/30">
                          <p className="truncate text-[11px] font-semibold text-[#00a884]">
                            {(replyRaw?.senderId === me.id ? "You" : members.find((x) => x.userId === replyRaw?.senderId)?.user?.name) || "Message"}
                          </p>
                          <p className="truncate text-xs opacity-80">
                            {replyDec
                              ? replyDec.ok
                                ? replyDec.kind === "image" ? "📷 Photo" : replyDec.text
                                : "🔒 Encrypted"
                              : "…"}
                          </p>
                        </div>
                      )}
                      {!d ? (
                        <p className="text-xs italic text-[#8696a0]">Decrypting…</p>
                      ) : !d.ok ? (
                        <p className="text-xs italic text-[#8696a0]">
                          🔒 Couldn&apos;t decrypt — sent to an older device key.
                        </p>
                      ) : d.kind === "image" ? (
                        <button onClick={() => onImage(d.text)} className="block overflow-hidden rounded-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.text} alt="shared" className="max-h-56 w-full rounded-md object-cover" />
                        </button>
                      ) : (
                        <p className="whitespace-pre-wrap break-words leading-snug">{d.text}</p>
                      )}
                      <span className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-[#8696a0]">
                        {formatMsgTime(m.createdAt)}
                        {mine && <Ticks state={tickFor(m)} />}
                      </span>
                      {/* message menu trigger */}
                      <button
                        onClick={() => setMsgMenu(msgMenu === m.id ? null : m.id)}
                        className={cn(
                          "absolute top-0.5 rounded p-0.5 opacity-0 hover:opacity-100 focus:opacity-100",
                          mine ? "left-0.5" : "right-0.5"
                        )}
                        title="Options"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 rotate-[-90deg] text-[#8696a0]" />
                      </button>
                      {msgMenu === m.id && (
                        <div className="absolute top-6 z-30 w-36 overflow-hidden rounded-xl bg-white text-[13px] text-gray-800 shadow-xl ring-1 ring-black/10 dark:bg-[#23333d] dark:text-white">
                          <button
                            onClick={() => {
                              setReplyTo(m);
                              setMsgMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10"
                          >
                            <Reply className="h-3.5 w-3.5" /> Reply
                          </button>
                          {d?.ok && d.kind !== "image" && (
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(d.text).catch(() => {});
                                pushToast("Copied", "Message copied to clipboard.");
                                setMsgMenu(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </button>
                          )}
                          {mine && (
                            <button
                              onClick={() => onDelete(m.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-red-500 hover:bg-gray-100 dark:hover:bg-white/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {typing && Date.now() - typing.at < 5000 && (
          <div className="mb-1.5 flex justify-start">
            <div className="flex items-center gap-1 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-[#1f2c34]">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="wa-typing-dot h-1.5 w-1.5 rounded-full bg-[#8696a0]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>

      {/* reply bar */}
      {replyTo && (
        <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2 dark:bg-[#1f2c34]">
          <div className="flex-1 overflow-hidden rounded-md border-l-4 border-[#00a884] bg-white px-2 py-1 dark:bg-[#0b141a]">
            <p className="text-[11px] font-semibold text-[#00a884]">
              {replyTo.senderId === me.id
                ? "You"
                : members.find((x) => x.userId === replyTo.senderId)?.user?.name || "Message"}
            </p>
            <p className="truncate text-xs dark:text-white">
              {decrypted.get(replyTo.id)?.ok
                ? decrypted.get(replyTo.id)?.kind === "image"
                  ? "📷 Photo"
                  : decrypted.get(replyTo.id)?.text
                : "🔒 Encrypted"}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)}>
            <X className="h-5 w-5 text-[#8696a0]" />
          </button>
        </div>
      )}

      {/* input */}
      <div className="flex items-end gap-1.5 bg-[#f0f2f5] px-2 py-1.5 dark:bg-[#0b141a]">
        <div className="flex flex-1 items-end gap-1 rounded-3xl bg-white px-1.5 py-1 dark:bg-[#1f2c34]">
          <button
            onClick={() => setShowEmoji((s) => !s)}
            className="rounded-full p-1.5 text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Smile className="h-6 w-6" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-24 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-[#8696a0] dark:text-white"
          />
          <button
            onClick={onAttach}
            className="rounded-full p-1.5 text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/10"
            title="Attach image"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {!input.trim() && (
            <button
              onClick={onAttach}
              className="rounded-full p-1.5 text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/10"
              title="Camera"
            >
              <Camera className="h-5 w-5" />
            </button>
          )}
        </div>
        <button
          onClick={() => (input.trim() ? onSend() : pushToast("Voice notes", "Hold-to-record voice notes are coming soon 🎙️"))}
          disabled={sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow transition hover:bg-[#008069] disabled:opacity-60"
        >
          {input.trim() ? <Send className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>

      {showEmoji && (
        <div className="grid max-h-44 grid-cols-10 gap-0.5 overflow-y-auto wa-scroll bg-white p-2 dark:bg-[#1f2c34]">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setInput(input + e)}
              className="rounded-lg p-1 text-center text-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================== STATUS PANE ==============================
function StatusPane({
  me, groups, myStatuses, onNew, onOpen,
}: {
  me: WAUser;
  groups: { userId: string; user: WAUser | null; items: StatusItem[] }[];
  myStatuses: { userId: string; user: WAUser | null; items: StatusItem[] } | null;
  onNew: () => void;
  onOpen: (userId: string) => void;
}) {
  const others = groups.filter((g) => g.userId !== me.id);
  return (
    <div className="h-full overflow-y-auto wa-scroll">
      <button
        onClick={onNew}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <div className="relative">
          <Avatar name={me.name} color={me.avatarColor} size={52} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#00a884] text-white dark:border-[#0b141a]">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </div>
        <span>
          <span className="block text-[15px] font-medium dark:text-white">My status</span>
          <span className="block text-[13px] text-gray-500 dark:text-[#8696a0]">
            {myStatuses ? `${myStatuses.items.length} update${myStatuses.items.length > 1 ? "s" : ""} · tap to add` : "Tap to add status update"}
          </span>
        </span>
      </button>
      {myStatuses && (
        <button
          onClick={() => onOpen(me.id)}
          className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <div className="rounded-full bg-[#00a884] p-[2.5px]">
            <Avatar name={me.name} color={me.avatarColor} size={46} />
          </div>
          <span>
            <span className="block text-[15px] dark:text-white">My updates</span>
            <span className="block text-[13px] text-gray-500 dark:text-[#8696a0]">
              {timeAgo(myStatuses.items[0].createdAt)}
            </span>
          </span>
        </button>
      )}
      <p className="px-4 pb-1 pt-2 text-[12px] font-medium text-gray-500 dark:text-[#8696a0]">
        RECENT UPDATES
      </p>
      {others.length === 0 && (
        <p className="px-4 py-4 text-center text-xs text-gray-400">
          No team updates yet — be the first to post 🎉
        </p>
      )}
      {others.map((g) => (
        <button
          key={g.userId}
          onClick={() => onOpen(g.userId)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <div className="rounded-full bg-[#00a884] p-[2.5px]">
            <div className="rounded-full bg-white p-[2px] dark:bg-[#0b141a]">
              <Avatar name={g.user?.name || "?"} color={g.user?.avatarColor || "#008069"} size={44} />
            </div>
          </div>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] dark:text-white">{g.user?.name || "Unknown"}</span>
            <span className="block text-[13px] text-gray-500 dark:text-[#8696a0]">
              {timeAgo(g.items[0].createdAt)} · {g.items.length} update{g.items.length > 1 ? "s" : ""}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================== CALLS PANE ==============================
function CallsPane({
  me, calls, users, onCall,
}: {
  me: WAUser;
  calls: CallItem[];
  users: WAUser[];
  onCall: (peer: WAUser, type: "voice" | "video") => void;
}) {
  const [filter, setFilter] = useState("");
  const peers = users.filter((u) => u.id !== me.id)
    .filter((u) => u.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-2">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-[#202c33]">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search or start a new call…"
            className="w-full bg-transparent text-sm outline-none dark:text-white"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto wa-scroll">
        {filter && (
          <>
            <p className="px-4 pb-1 pt-2 text-[12px] font-medium text-gray-500 dark:text-[#8696a0]">
              PEOPLE
            </p>
            {peers.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                <Avatar name={p.name} color={p.avatarColor} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] dark:text-white">{p.name}</span>
                  <span className="block text-[13px] text-gray-500 dark:text-[#8696a0]">
                    {p.isOnline ? "online" : formatLastSeen(p.lastSeen, false)}
                  </span>
                </span>
                <button onClick={() => onCall(p, "voice")} className="rounded-full p-2 text-[#00a884] hover:bg-black/5">
                  <Phone className="h-5 w-5" />
                </button>
                <button onClick={() => onCall(p, "video")} className="rounded-full p-2 text-[#00a884] hover:bg-black/5">
                  <Video className="h-5 w-5" />
                </button>
              </div>
            ))}
          </>
        )}
        <p className="px-4 pb-1 pt-2 text-[12px] font-medium text-gray-500 dark:text-[#8696a0]">
          RECENT
        </p>
        {calls.length === 0 && (
          <p className="px-4 py-4 text-center text-xs text-gray-400">
            No calls yet. Search above to call a colleague 📞
          </p>
        )}
        {calls.map((c) => {
          const outgoing = c.callerId === me.id;
          const peer = outgoing ? c.receiver : c.caller;
          const missed = c.status === "missed";
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5">
              <Avatar name={peer?.name || "?"} color={peer?.avatarColor || "#008069"} size={46} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[15px]", missed && !outgoing ? "text-red-500" : "dark:text-white")}>
                  {peer?.name || "Unknown"}
                </span>
                <span className="flex items-center gap-1 text-[13px] text-gray-500 dark:text-[#8696a0]">
                  {missed && !outgoing ? (
                    <PhoneMissed className="h-3.5 w-3.5 text-red-500" />
                  ) : outgoing ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#00a884]" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-[#00a884]" />
                  )}
                  {formatListTime(c.createdAt)}
                  {c.durationSec > 0 && ` · ${formatDuration(c.durationSec)}`}
                  {c.type === "video" ? " · Video" : " · Voice"}
                </span>
              </span>
              <button
                onClick={() => peer && onCall(peer, (c.type as "voice" | "video") || "voice")}
                className="rounded-full p-2 text-[#00a884] hover:bg-black/5"
              >
                {c.type === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================== MODALS ==============================
function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85%] overflow-hidden rounded-t-3xl bg-white dark:bg-[#111b21]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[15px] font-semibold dark:text-white">{title}</p>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-5 w-5 dark:text-white" />
          </button>
        </div>
        <div className="overflow-y-auto wa-scroll px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

function NewChatModal({
  users, onClose, onPick, onNewGroup,
}: {
  users: WAUser[];
  onClose: () => void;
  onPick: (u: WAUser) => void;
  onNewGroup: () => void;
}) {
  const [q, setQ] = useState("");
  const list = users.filter(
    (u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.phone.includes(q)
  );
  return (
    <Sheet title="New chat" onClose={onClose}>
      <div className="mb-2 flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-[#202c33]">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or number"
          className="w-full bg-transparent text-sm outline-none dark:text-white"
        />
      </div>
      <button
        onClick={onNewGroup}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-white">
          <Users className="h-5 w-5" />
        </span>
        <span className="text-[15px] font-medium dark:text-white">New group</span>
      </button>
      <p className="px-2 pb-1 pt-2 text-[12px] text-gray-500 dark:text-[#8696a0]">
        CONTACTS · {list.length}
      </p>
      {list.map((u) => (
        <button
          key={u.id}
          onClick={() => onPick(u)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <Avatar name={u.name} color={u.avatarColor} size={46} online={u.isOnline} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[15px] dark:text-white">{u.name}</span>
            <span className="block truncate text-[13px] text-gray-500 dark:text-[#8696a0]">
              {u.about}
            </span>
          </span>
        </button>
      ))}
      {list.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">No contacts match.</p>
      )}
    </Sheet>
  );
}

function NewGroupModal({
  users, onClose, onCreate,
}: {
  users: WAUser[];
  onClose: () => void;
  onCreate: (name: string, ids: string[]) => void;
}) {
  const [gname, setGname] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  return (
    <Sheet title="New group" onClose={onClose}>
      <input
        value={gname}
        onChange={(e) => setGname(e.target.value)}
        placeholder="Group name (e.g. Q4 Planning 🎯)"
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#008069] dark:border-white/10 dark:bg-[#202c33] dark:text-white"
      />
      <p className="px-1 pb-1 pt-3 text-[12px] text-gray-500 dark:text-[#8696a0]">
        ADD MEMBERS · {sel.size} selected
      </p>
      <div className="max-h-64 overflow-y-auto wa-scroll">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => toggle(u.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <Avatar name={u.name} color={u.avatarColor} size={42} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] dark:text-white">{u.name}</span>
              <span className="block truncate text-xs text-gray-500 dark:text-[#8696a0]">
                {u.about}
              </span>
            </span>
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border",
                sel.has(u.id) ? "border-[#00a884] bg-[#00a884] text-white" : "border-gray-300 text-transparent"
              )}
            >
              ✓
            </span>
          </button>
        ))}
      </div>
      <button
        disabled={!gname.trim() || sel.size === 0}
        onClick={() => onCreate(gname.trim(), Array.from(sel))}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#008069] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        <Users className="h-4 w-4" /> Create encrypted group
      </button>
    </Sheet>
  );
}

function NewStatusModal({
  onClose, onPost,
}: {
  onClose: () => void;
  onPost: (text: string, color: string) => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(STATUS_COLORS[0]);
  return (
    <Sheet title="New status" onClose={onClose}>
      <div
        className="flex min-h-44 items-center justify-center rounded-2xl p-6 text-center text-lg font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {text || "Type your update…"}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share an update with your team…"
        rows={2}
        maxLength={280}
        className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#008069] dark:border-white/10 dark:bg-[#202c33] dark:text-white"
      />
      <div className="mt-2 flex gap-2">
        {STATUS_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn(
              "h-9 w-9 rounded-full ring-2 ring-offset-2 dark:ring-offset-[#111b21]",
              color === c ? "ring-[#00a884]" : "ring-transparent"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        disabled={!text.trim()}
        onClick={() => onPost(text.trim(), color)}
        className="mt-4 w-full rounded-xl bg-[#008069] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        Post status
      </button>
    </Sheet>
  );
}

function ProfileModal({
  me, onClose, onSave, onVerify,
}: {
  me: WAUser;
  onClose: () => void;
  onSave: (name: string, about: string) => void;
  onVerify: () => void;
}) {
  const [name, setName] = useState(me.name);
  const [about, setAbout] = useState(me.about);
  return (
    <Sheet title="My profile" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 py-2">
        <Avatar name={name || me.name} color={me.avatarColor} size={88} />
        <p className="text-xs text-gray-500 dark:text-[#8696a0]">{me.phone}</p>
      </div>
      <label className="mt-2 block text-xs font-medium text-gray-500 dark:text-[#8696a0]">
        <span className="flex items-center gap-1"><User className="h-3 w-3" /> Name</span>
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#008069] dark:border-white/10 dark:bg-[#202c33] dark:text-white"
      />
      <label className="mt-3 block text-xs font-medium text-gray-500 dark:text-[#8696a0]">
        About
      </label>
      <input
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#008069] dark:border-white/10 dark:bg-[#202c33] dark:text-white"
      />
      <button
        onClick={() => onSave(name.trim() || me.name, about.trim() || me.about)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#008069] py-2.5 text-sm font-semibold text-white"
      >
        <Pencil className="h-4 w-4" /> Save changes
      </button>
      <button
        onClick={onVerify}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#008069]/10 py-2.5 text-sm font-semibold text-[#008069] dark:text-[#00a884]"
      >
        <Lock className="h-4 w-4" /> View my encryption key
      </button>
    </Sheet>
  );
}

function ContactDrawer({
  conv, myId, members, users, images, onClose, onVerify, onCall, onAddMembers, onImage,
}: {
  conv: ConversationFull;
  myId: string;
  members: Member[];
  users: WAUser[];
  images: string[];
  onClose: () => void;
  onVerify: () => void;
  onCall: (peer: WAUser) => void;
  onAddMembers: (ids: string[]) => void;
  onImage: (src: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const peer = dmPeer({ ...conv, members } as ConversationFull, myId);
  const name = conv.isGroup ? conv.name || "Group" : peer?.name || "Unknown";
  const color = conv.isGroup ? conv.avatarColor : peer?.avatarColor || "#008069";
  const candidates = users.filter(
    (u) => u.id !== myId && !members.some((m) => m.userId === u.id)
  );
  return (
    <div className="absolute inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-[88%] flex-col overflow-y-auto wa-scroll bg-[#f0f2f5] dark:bg-[#0b141a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-[#008069] px-2 py-2 text-white">
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
          <p className="text-[15px] font-semibold">Contact info</p>
        </div>
        <div className="flex flex-col items-center bg-white px-4 py-6 dark:bg-[#111b21]">
          <Avatar name={name} color={color} size={96} isGroup={conv.isGroup} />
          <p className="mt-2 text-lg font-semibold dark:text-white">{name}</p>
          <p className="text-[13px] text-gray-500 dark:text-[#8696a0]">
            {conv.isGroup
              ? `Group · ${members.length} members`
              : peer?.phone || ""}
          </p>
          {!conv.isGroup && peer && (
            <div className="mt-3 flex gap-6">
              <button
                onClick={() => onCall(peer)}
                className="flex flex-col items-center gap-1 text-[#008069] dark:text-[#00a884]"
              >
                <Phone className="h-5 w-5" />
                <span className="text-[11px]">Call</span>
              </button>
              <button
                onClick={onVerify}
                className="flex flex-col items-center gap-1 text-[#008069] dark:text-[#00a884]"
              >
                <Lock className="h-5 w-5" />
                <span className="text-[11px]">Security</span>
              </button>
            </div>
          )}
        </div>
        {!conv.isGroup && peer && (
          <div className="mt-2 bg-white px-4 py-3 dark:bg-[#111b21]">
            <p className="text-[12px] text-gray-500 dark:text-[#8696a0]">About</p>
            <p className="text-[14px] dark:text-white">{peer.about}</p>
          </div>
        )}
        {conv.isGroup && conv.description && (
          <div className="mt-2 bg-white px-4 py-3 dark:bg-[#111b21]">
            <p className="text-[12px] text-gray-500 dark:text-[#8696a0]">Description</p>
            <p className="text-[14px] dark:text-white">{conv.description}</p>
          </div>
        )}
        <button
          onClick={onVerify}
          className="mt-2 flex items-center gap-3 bg-white px-4 py-3 text-left dark:bg-[#111b21]"
        >
          <Lock className="h-5 w-5 shrink-0 text-[#00a884]" />
          <span>
            <span className="block text-[14px] dark:text-white">Encryption</span>
            <span className="block text-[12px] text-gray-500 dark:text-[#8696a0]">
              Messages are end-to-end encrypted. Tap to verify safety numbers.
            </span>
          </span>
        </button>
        {images.length > 0 && (
          <div className="mt-2 bg-white px-4 py-3 dark:bg-[#111b21]">
            <p className="mb-2 text-[12px] text-gray-500 dark:text-[#8696a0]">
              Shared media · {images.length}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {images.slice(0, 9).map((src, i) => (
                <button key={i} onClick={() => onImage(src)} className="overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
        {conv.isGroup && (
          <div className="mb-6 mt-2 bg-white px-4 py-3 dark:bg-[#111b21]">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-gray-500 dark:text-[#8696a0]">
                {members.length} MEMBERS
              </p>
              <button
                onClick={() => setAdding((a) => !a)}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#00a884]"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 py-2">
                <Avatar name={m.user?.name || "?"} color={m.user?.avatarColor || "#008069"} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] dark:text-white">
                    {m.userId === myId ? "You" : m.user?.name}
                  </span>
                  <span className="block text-[12px] text-gray-500 dark:text-[#8696a0]">
                    {m.role === "admin" ? "Group admin" : m.user?.about || ""}
                  </span>
                </span>
                {m.userId !== myId && m.user && (
                  <button
                    onClick={() => onCall(m.user!)}
                    className="rounded-full p-2 text-[#00a884] hover:bg-black/5"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {adding && (
              <div className="mt-2 rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                {candidates.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    onClick={() =>
                      setSel((s) => {
                        const n = new Set(s);
                        if (n.has(u.id)) n.delete(u.id);
                        else n.add(u.id);
                        return n;
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <Avatar name={u.name} color={u.avatarColor} size={32} />
                    <span className="flex-1 truncate text-[13px] dark:text-white">{u.name}</span>
                    <span className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border text-xs",
                      sel.has(u.id) ? "border-[#00a884] bg-[#00a884] text-white" : "border-gray-300 text-transparent"
                    )}>
                      ✓
                    </span>
                  </button>
                ))}
                <button
                  disabled={sel.size === 0}
                  onClick={() => {
                    onAddMembers(Array.from(sel));
                    setSel(new Set());
                    setAdding(false);
                  }}
                  className="mt-2 w-full rounded-lg bg-[#008069] py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Add {sel.size} member{sel.size === 1 ? "" : "s"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyModal({
  me, members, isGroup, onClose,
}: {
  me: WAUser;
  members: Member[];
  isGroup: boolean;
  onClose: () => void;
}) {
  const [prints, setPrints] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = [{ id: me.id, key: me.publicKey }];
      for (const m of members) {
        if (m.user && m.userId !== me.id) all.push({ id: m.userId, key: m.user.publicKey });
      }
      for (const a of all) {
        try {
          const fp = await keyFingerprint(a.key);
          if (!cancelled) setPrints((p) => ({ ...p, [a.id]: fp }));
        } catch {
          if (!cancelled) setPrints((p) => ({ ...p, [a.id]: "unavailable" }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, members]);

  const others = members.filter((m) => m.userId !== me.id && m.user);
  return (
    <Sheet title="Encryption verification" onClose={onClose}>
      <div className="rounded-2xl bg-[#008069]/10 p-3 text-[12px] leading-relaxed text-gray-700 dark:text-[#aebac1]">
        <p className="flex items-center gap-1.5 font-semibold text-[#008069] dark:text-[#00a884]">
          <ShieldCheck className="h-4 w-4" /> Safety numbers
        </p>
        <p className="mt-1">
          {isGroup
            ? "Each member below has a unique safety number. If they match on everyone's device, the group is secure."
            : "If this safety number matches on your contact's device, your conversation is secure."}
        </p>
      </div>
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-gray-100 p-3 dark:border-white/10">
          <p className="text-[13px] font-semibold dark:text-white">You · {me.name}</p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-gray-600 dark:text-[#aebac1]">
            {prints[me.id] || "computing…"}
          </p>
        </div>
        {others.map((m) => (
          <div key={m.userId} className="rounded-2xl border border-gray-100 p-3 dark:border-white/10">
            <p className="text-[13px] font-semibold dark:text-white">{m.user!.name}</p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-gray-600 dark:text-[#aebac1]">
              {prints[m.userId] || "computing…"}
            </p>
          </div>
        ))}
        {others.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            Open a chat and tap contact info → Encryption to verify a contact.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function StatusViewer({
  groups, userId, idx, onClose, onNextUser,
}: {
  groups: { userId: string; user: WAUser | null; items: StatusItem[] }[];
  userId: string;
  idx: number;
  onClose: () => void;
  onNextUser: (uid: string) => void;
}) {
  const gi = groups.findIndex((g) => g.userId === userId);
  const group = groups[gi];
  const [i, setI] = useState(idx);
  useEffect(() => setI(idx), [userId, idx]);
  useEffect(() => {
    if (!group) {
      onClose();
      return;
    }
    const t = setTimeout(() => {
      if (i < group.items.length - 1) setI(i + 1);
      else if (gi < groups.length - 1) onNextUser(groups[gi + 1].userId);
      else onClose();
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, group, gi]);
  if (!group) return null;
  const item = group.items[i];
  return (
    <div className="absolute inset-0 z-[75] flex flex-col" style={{ backgroundColor: item.bgColor }}>
      <div className="flex gap-1 px-3 pt-12">
        {group.items.map((_, k) => (
          <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            {k < i && <div className="h-full w-full bg-white" />}
            {k === i && (
              <div
                key={i}
                className="h-full bg-white"
                style={{ animation: "wa-status-progress 5s linear forwards" }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-3 text-white">
        <button onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={group.user?.name || "?"} color="rgba(255,255,255,0.25)" size={36} />
        <span>
          <span className="block text-sm font-semibold">{group.user?.name}</span>
          <span className="block text-[11px] text-white/80">{timeAgo(item.createdAt)}</span>
        </span>
      </div>
      <button
        className="flex flex-1 items-center justify-center p-8 text-center text-2xl font-bold leading-snug text-white"
        onClick={() => {
          if (i < group.items.length - 1) setI(i + 1);
          else onClose();
        }}
      >
        {item.textContent}
      </button>
      <p className="pb-8 text-center text-[11px] text-white/70">
        Tap to continue · statuses disappear after 24h
      </p>
    </div>
  );
}

function CallOverlay({
  peer, type, outgoing, startedAt, onEnd,
}: {
  peer: WAUser;
  type: string;
  outgoing: boolean;
  startedAt: number;
  onEnd: () => void;
}) {
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(type === "video");
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const ringing = secs < 3;
  return (
    <div className="absolute inset-0 z-[80] flex flex-col items-center bg-gradient-to-b from-[#0b141a] to-[#111b21] px-6 pb-10 pt-16 text-white">
      <p className="text-[12px] uppercase tracking-widest text-[#8696a0]">
        {type === "video" ? "PingPro Video" : "PingPro Voice"} · 🔒 encrypted
      </p>
      <div className="relative mt-6">
        {ringing && (
          <span className="wa-pulse-ring absolute inset-0 rounded-full bg-[#00a884]" />
        )}
        <Avatar name={peer.name} color={peer.avatarColor} size={110} />
      </div>
      <p className="mt-4 text-xl font-semibold">{peer.name}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-[#8696a0]">
        <Clock className="h-3.5 w-3.5" />
        {ringing ? (outgoing ? "Ringing…" : "Connecting…") : formatDuration(secs)}
      </p>
      <div className="mt-auto flex w-full items-center justify-center gap-8">
        <button
          onClick={() => setMuted((m) => !m)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            muted ? "bg-white text-black" : "bg-white/10"
          )}
          title="Mute"
        >
          <Mic className="h-5 w-5" />
        </button>
        <button
          onClick={onEnd}
          className="flex h-16 w-16 rotate-[135deg] items-center justify-center rounded-full bg-red-500 shadow-lg"
          title="End call"
        >
          <Phone className="h-7 w-7" />
        </button>
        <button
          onClick={() => setSpeaker((s) => !s)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            speaker ? "bg-white text-black" : "bg-white/10"
          )}
          title="Speaker"
        >
          {type === "video" ? <Video className="h-5 w-5" /> : <CheckCheck className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-6 text-[11px] text-[#8696a0]">
        Demo call UI — the call log is saved in real time.
      </p>
    </div>
  );
}

function IncomingCall({
  call, onAccept, onDecline,
}: {
  call: CallItem;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = call.caller?.name || "Unknown";
  const color = call.caller?.avatarColor || "#008069";
  return (
    <div className="absolute inset-0 z-[80] flex flex-col items-center bg-gradient-to-b from-[#0b141a] to-[#111b21] px-6 pb-10 pt-16 text-white">
      <p className="text-[12px] uppercase tracking-widest text-[#8696a0]">
        Incoming {call.type} call · 🔒 encrypted
      </p>
      <div className="relative mt-6">
        <span className="wa-pulse-ring absolute inset-0 rounded-full bg-[#00a884]" />
        <Avatar name={name} color={color} size={110} />
      </div>
      <p className="mt-4 text-xl font-semibold">{name}</p>
      <p className="mt-1 text-sm text-[#8696a0]">is calling you…</p>
      <div className="mt-auto flex w-full items-center justify-center gap-10">
        <button
          onClick={onDecline}
          className="flex h-16 w-16 rotate-[135deg] items-center justify-center rounded-full bg-red-500"
        >
          <Phone className="h-7 w-7" />
        </button>
        <button
          onClick={onAccept}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00a884]"
        >
          {call.type === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
        </button>
      </div>
    </div>
  );
}

// re-export to avoid unused imports in some builds
export { PhoneIncoming, PhoneOutgoing };
