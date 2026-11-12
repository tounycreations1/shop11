import type {
  BoothDetailDto,
  BoothListResponse,
  ChatMessage,
  ChatThread,
  DeviceKind,
  Gender,
  JoinResponse,
  MarketStats,
  ProductDto,
  ProductKind,
  Role,
} from "@/lib/game/types";

export type DraftProduct = { kind: ProductKind; name: string; price: string; detail: string };
export type BoothDraft = {
  brandName: string;
  category: string;
  tagline: string;
  description: string;
  contact: string;
  emoji: string;
  logoUrl: string;
  color: string;
  avatarGender: Gender;
};
export type BoothActionResponse = {
  ok?: boolean;
  slot?: number;
  error?: string;
  products?: ProductDto[];
  booths?: BoothListResponse["booths"];
  feed?: BoothListResponse["feed"];
  stats?: MarketStats;
};
export type BoothAction =
  | "claim"
  | "update"
  | "live"
  | "product.add"
  | "product.remove"
  | "product.feature"
  | "release";
export type ClientSession = { id: string; secret: string; boothSlot?: number | null };

export function detectDevice(): DeviceKind {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Android|iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua) || coarse) return "mobile";
  return "desktop";
}

export async function apiJoin(input: {
  name: string;
  device: DeviceKind;
  role: Role;
  gender?: Gender;
  boothSlot?: number | null;
  resumeId?: string;
  resumeSecret?: string;
}): Promise<JoinResponse> {
  const response = await fetch("/api/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("join_failed");
  return (await response.json()) as JoinResponse;
}

export async function apiMarket(): Promise<BoothListResponse> {
  const response = await fetch("/api/booths", { cache: "no-store" });
  if (!response.ok) throw new Error("market_failed");
  return (await response.json()) as BoothListResponse;
}

export async function apiBoothDetail(slot: number, countVisit = false): Promise<BoothDetailDto | null> {
  const response = await fetch(`/api/booths/${slot}${countVisit ? "?visit=1" : ""}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("detail_failed");
  return ((await response.json()) as { booth: BoothDetailDto }).booth;
}

export async function apiOwnerBooth(slot: number, session: ClientSession): Promise<BoothDetailDto | null> {
  const response = await fetch(`/api/booths/${slot}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: session.id, secret: session.secret }),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("owner_failed");
  return ((await response.json()) as { booth: BoothDetailDto }).booth;
}

export async function apiBoothAction(
  action: BoothAction,
  session: ClientSession,
  payload: Record<string, unknown> = {},
): Promise<BoothActionResponse> {
  const response = await fetch("/api/booths", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, id: session.id, secret: session.secret, ...payload }),
  });
  const data = (await response.json().catch(() => ({}))) as BoothActionResponse;
  return response.ok ? data : { ...data, error: data.error ?? "request_failed" };
}

/**
 * Downscales and compresses a sign locally (max 1000×360) before upload. This
 * makes camera photos from phones cheap to sync to every other visitor.
 */
export async function apiUploadSign(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("unsupported_type");

  const bitmap = await createImageBitmap(file);
  const maxW = 1000;
  const maxH = 360;
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("image_failed");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86),
  );
  if (!blob) throw new Error("image_failed");

  const form = new FormData();
  form.append("file", blob, "sign.webp");
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? "upload_failed");
  return data.url;
}

export async function apiLeave(session: ClientSession): Promise<void> {
  try {
    const payload = JSON.stringify({ id: session.id, secret: session.secret });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/leave", new Blob([payload], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    await fetch("/api/leave", {
      method: "POST",
      body: payload,
      keepalive: true,
      headers: { "content-type": "text/plain;charset=UTF-8" },
    });
  } catch {
    /* best effort */
  }
}

/* --------------------------------- chat ---------------------------------- */

export type ChatResponse = {
  error?: string;
  messages?: ChatMessage[];
  threads?: ChatThread[];
  unread?: number;
};

/** Visitor: send | list (slot, text). Seller: threads | thread | reply | unread. */
export async function apiChat(
  action: "send" | "list" | "threads" | "thread" | "reply" | "unread",
  session: ClientSession,
  payload: Record<string, unknown> = {},
): Promise<ChatResponse> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id: session.id, secret: session.secret, ...payload }),
    });
    const data = (await response.json().catch(() => ({}))) as ChatResponse;
    return response.ok ? data : { ...data, error: data.error ?? "request_failed" };
  } catch {
    return { error: "network" };
  }
}
