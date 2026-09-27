// In-memory realtime pub/sub for SSE. Works for single-instance preview.
// Each connected user has a set of subscriber callbacks.

export type RealtimeEvent = {
  type:
    | "message:new"
    | "typing"
    | "presence"
    | "conversation:new"
    | "conversation:updated"
    | "message:read"
    | "message:deleted"
    | "status:new"
    | "call:new";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

type Subscriber = {
  userId: string;
  send: (event: RealtimeEvent) => void;
};

const globalForRealtime = globalThis as typeof globalThis & {
  __pingpro_subs?: Set<Subscriber>;
};

function getSubs(): Set<Subscriber> {
  if (!globalForRealtime.__pingpro_subs) {
    globalForRealtime.__pingpro_subs = new Set();
  }
  return globalForRealtime.__pingpro_subs;
}

export function subscribe(sub: Subscriber): () => void {
  const subs = getSubs();
  subs.add(sub);
  return () => {
    subs.delete(sub);
  };
}

export function broadcastToUsers(userIds: string[], event: RealtimeEvent) {
  const subs = getSubs();
  const set = new Set(userIds);
  for (const sub of subs) {
    if (set.has(sub.userId)) {
      try {
        sub.send(event);
      } catch {
        // ignore broken pipe
      }
    }
  }
}

export function broadcastAll(event: RealtimeEvent) {
  const subs = getSubs();
  for (const sub of subs) {
    try {
      sub.send(event);
    } catch {
      // ignore
    }
  }
}

export function onlineUserIds(): string[] {
  const subs = getSubs();
  return Array.from(new Set(Array.from(subs).map((s) => s.userId)));
}
