// ---------------------------------------------------------------------------
// Farsha (فرشة) — shared street-market layout.
// 100 real shop units on a tiled pedestrian boulevard. Geometry is shared by
// the server, collision, navigation and renderer so every device sees the same
// market in exactly the same place.
// ---------------------------------------------------------------------------

export const APP_NAME = "Farsha";
export const APP_NAME_AR = "فرشة";

export const PLAYER_RADIUS = 18;
export const PLAYER_TIMEOUT_MS = 14_000;
export const SYNC_INTERVAL_MS = 140;
export const HIDDEN_SYNC_INTERVAL_MS = 1600;
export const MOVE_SPEED_VISITOR = 285;
export const MOVE_SPEED_SELLER = 250;
export const MAX_NAME_LENGTH = 16;
export const NEARBY_PLAYER_RADIUS = 1100;
export const MAX_NEARBY_PLAYERS = 90;
export const MAX_ACTIVE_PLAYERS = 240;

/**
 * WhatsApp number of the market management (digits only, with country code),
 * e.g. NEXT_PUBLIC_ADMIN_WHATSAPP=201001234567. Used by "استأجر الآن".
 */
export const ADMIN_WHATSAPP = (process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "").replace(/\D/g, "");

/** Plain navy road (no tiles). */
export const ROAD_COLOR = "#0b2557";

export const ENTRANCE_X = 1595;
export const ENTRANCE_Y = 2740;

/* ------------------------------ 100 shops ------------------------------- */

export const BOOTH_COLS = 10;
export const BOOTH_ROWS = 10;
export const BOOTH_COUNT = BOOTH_COLS * BOOTH_ROWS; // 100
export const BOOTH_W = 194;
export const BOOTH_H = 174;
export const PITCH_X = 292;
export const PITCH_Y = 252;
export const ORIGIN_X = 230;
export const ORIGIN_Y = 230;

export const WORLD_WIDTH = ORIGIN_X * 2 + (BOOTH_COLS - 1) * PITCH_X + BOOTH_W; // 3118
export const WORLD_HEIGHT = ORIGIN_Y * 2 + (BOOTH_ROWS - 1) * PITCH_Y + BOOTH_H; // 2902

/** Five arcades of twenty shops (two rows each). */
export const ZONE_ROWS = 2;
export const ZONE_NAMES = ["A", "B", "C", "D", "E"] as const;
export const ZONE_TINTS = ["#2dd4bf", "#60a5fa", "#a78bfa", "#f59e0b", "#fb7185"];
export const ZONE_NAMES_AR = ["البوابة", "الحِرف", "الأزياء", "النخبة", "الساحة"];

/** Seller editable limits. */
export const MAX_BRAND = 28;
export const MAX_TAGLINE = 72;
export const MAX_DESCRIPTION = 520;
export const MAX_LIVE_MESSAGE = 80;
export const MAX_PRODUCT_NAME = 44;
export const MAX_PRODUCT_PRICE = 24;
export const MAX_PRODUCT_DETAIL = 160;
export const MAX_PRODUCTS = 30;
export const MAX_CHAT_LENGTH = 300;
export const MAX_SIGN_UPLOAD_BYTES = 2_000_000;

export const PLAYER_COLORS = [
  "#38bdf8",
  "#f472b6",
  "#facc15",
  "#4ade80",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
  "#c084fc",
  "#2dd4bf",
  "#e879f9",
  "#84cc16",
  "#fca5a5",
  "#93c5fd",
  "#fde047",
  "#5eead4",
];

export const SHOP_THEMES = [
  { key: "teal", wall: "#174b51", trim: "#5eead4", awning: "#0f766e", light: "#99f6e4" },
  { key: "blue", wall: "#1e3a5f", trim: "#93c5fd", awning: "#1d4ed8", light: "#bfdbfe" },
  { key: "violet", wall: "#46315f", trim: "#d8b4fe", awning: "#7e22ce", light: "#e9d5ff" },
  { key: "amber", wall: "#654226", trim: "#fcd34d", awning: "#b45309", light: "#fef3c7" },
  { key: "rose", wall: "#633044", trim: "#fda4af", awning: "#be123c", light: "#ffe4e6" },
  { key: "slate", wall: "#334155", trim: "#cbd5e1", awning: "#475569", light: "#e2e8f0" },
];

export const CATEGORIES = [
  { key: "food", label: "مأكولات ومشروبات" },
  { key: "fashion", label: "أزياء وملابس" },
  { key: "handmade", label: "مشغولات يدوية" },
  { key: "tech", label: "تقنية وإلكترونيات" },
  { key: "beauty", label: "عناية وتجميل" },
  { key: "home", label: "منزل وديكور" },
  { key: "services", label: "خدمات" },
  { key: "other", label: "متنوع" },
];

export function categoryLabel(key: string): string {
  return CATEGORIES.find((category) => category.key === key)?.label ?? "متنوع";
}

export function categoryEmoji(key: string): string {
  // Kept for backwards compatibility with existing rows; the modern UI uses
  // vector category marks instead of emoji.
  return CATEGORIES.some((category) => category.key === key) ? "" : "";
}

export type BoothRect = { x: number; y: number; w: number; h: number };

export function isValidSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= BOOTH_COUNT;
}

export function boothGrid(slot: number): { col: number; row: number } {
  const index = slot - 1;
  return { col: index % BOOTH_COLS, row: Math.floor(index / BOOTH_COLS) };
}

export function boothSlot(col: number, row: number): number {
  return row * BOOTH_COLS + col + 1;
}

export function boothRect(slot: number): BoothRect {
  const { col, row } = boothGrid(slot);
  return {
    x: ORIGIN_X + col * PITCH_X,
    y: ORIGIN_Y + row * PITCH_Y,
    w: BOOTH_W,
    h: BOOTH_H,
  };
}

export function boothCenter(slot: number): { x: number; y: number } {
  const rect = boothRect(slot);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function boothZone(slot: number): number {
  return Math.min(ZONE_NAMES.length - 1, Math.floor(boothGrid(slot).row / ZONE_ROWS));
}

export function zoneLabel(slot: number): string {
  return ZONE_NAMES[boothZone(slot)] ?? "A";
}

export function zoneNameAr(slot: number): string {
  return ZONE_NAMES_AR[boothZone(slot)] ?? ZONE_NAMES_AR[0];
}

/** Door side is decided by the slot, exactly as the renderer draws it. */
export const DOOR_W = 44;
export function doorOnRight(slot: number): boolean {
  return (slot % 4) % 2 === 0;
}

/** Centre of the shop window (the glass that carries the live offer). */
function windowCenterOffset(slot: number): number {
  const windowW = BOOTH_W - DOOR_W - 46;
  return doorOnRight(slot) ? 12 + windowW / 2 : 12 + DOOR_W + 10 + windowW / 2;
}

/** The seller's own walking avatar spawns on the pavement in front of the window. */
export function boothStandingPoint(slot: number): { x: number; y: number } {
  const rect = boothRect(slot);
  return { x: rect.x + windowCenterOffset(slot), y: rect.y + rect.h + 31 };
}

/** The seller's chosen representative stands right outside the door. */
export function boothRepPoint(slot: number): { x: number; y: number } {
  const rect = boothRect(slot);
  const doorCenter = doorOnRight(slot) ? BOOTH_W - 12 - DOOR_W / 2 : 12 + DOOR_W / 2;
  return { x: rect.x + doorCenter, y: rect.y + rect.h + 31 };
}

/** The featured-product stand sits on the pavement beside the shop. */
export const STAND_W = 58;
export const STAND_H = 90;
export const STAND_GAP = 20;
export function boothStandRect(slot: number): BoothRect {
  const rect = boothRect(slot);
  return { x: rect.x + rect.w + STAND_GAP, y: rect.y + rect.h - STAND_H + 6, w: STAND_W, h: STAND_H };
}

function slotsAround(x: number, y: number): number[] {
  const col = Math.floor((x - ORIGIN_X) / PITCH_X);
  const row = Math.floor((y - ORIGIN_Y) / PITCH_Y);
  const output: number[] = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    if (r < 0 || r >= BOOTH_ROWS) continue;
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (c < 0 || c >= BOOTH_COLS) continue;
      output.push(boothSlot(c, r));
    }
  }
  return output;
}

/** Tap target of a shop's representative (person + chat bubble above). */
export function repSlotAtPoint(x: number, y: number): number | null {
  for (const slot of slotsAround(x, y)) {
    const rep = boothRepPoint(slot);
    if (x >= rep.x - 30 && x <= rep.x + 30 && y >= rep.y - 120 && y <= rep.y + 12) return slot;
  }
  return null;
}

/** Tap target of the featured product stand ("المزيد"). */
export function standSlotAtPoint(x: number, y: number): number | null {
  for (const slot of slotsAround(x, y)) {
    const stand = boothStandRect(slot);
    if (x >= stand.x - 6 && x <= stand.x + stand.w + 6 && y >= stand.y - 6 && y <= stand.y + stand.h + 8) return slot;
  }
  return null;
}

/** O(1) collision against the nine shop rectangles around a point. */
export function isBlocked(x: number, y: number, radius = PLAYER_RADIUS): boolean {
  const pad = radius * 0.72;
  const col = Math.floor((x - ORIGIN_X) / PITCH_X);
  const row = Math.floor((y - ORIGIN_Y) / PITCH_Y);

  for (let r = row - 1; r <= row + 1; r += 1) {
    if (r < 0 || r >= BOOTH_ROWS) continue;
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (c < 0 || c >= BOOTH_COLS) continue;
      const rect = boothRect(boothSlot(c, r));
      if (
        x + pad > rect.x + 4 &&
        x - pad < rect.x + rect.w - 4 &&
        y + pad > rect.y + 22 &&
        y - pad < rect.y + rect.h - 8
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Includes the sign and awning, making taps on real phone screens forgiving. */
export function slotAtPoint(x: number, y: number): number | null {
  const col = Math.floor((x - ORIGIN_X + 34) / PITCH_X);
  const row = Math.floor((y - ORIGIN_Y + 34) / PITCH_Y);
  if (col < 0 || col >= BOOTH_COLS || row < 0 || row >= BOOTH_ROWS) return null;
  const slot = boothSlot(col, row);
  const rect = boothRect(slot);
  if (
    x >= rect.x - 30 &&
    x <= rect.x + rect.w + 30 &&
    y >= rect.y - 70 &&
    y <= rect.y + rect.h + 20
  ) {
    return slot;
  }
  return null;
}

export function clampToWorld(value: number, axis: "x" | "y"): number {
  const max = axis === "x" ? WORLD_WIDTH : WORLD_HEIGHT;
  return Math.min(max - PLAYER_RADIUS, Math.max(PLAYER_RADIUS, value));
}

export function shopThemeFor(slot: number, color?: string) {
  if (color) {
    const match = SHOP_THEMES.find((theme) => theme.trim.toLowerCase() === color.toLowerCase());
    if (match) return match;
  }
  return SHOP_THEMES[slot % SHOP_THEMES.length];
}
