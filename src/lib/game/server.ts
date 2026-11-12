import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { players, type PlayerRow } from "@/db/schema";
import {
  ENTRANCE_X,
  ENTRANCE_Y,
  MAX_ACTIVE_PLAYERS,
  MAX_NAME_LENGTH,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  PLAYER_TIMEOUT_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  isBlocked,
} from "@/lib/game/constants";
import type { DeviceKind, Direction, Gender, PlayerDto, Role } from "@/lib/game/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let lastCleanupAt = 0;
let activeCache: { at: number; rows: PlayerRow[] } | null = null;

export async function cleanupStalePlayers(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastCleanupAt < 4000) return;
  lastCleanupAt = now;
  const cutoff = new Date(now - PLAYER_TIMEOUT_MS);
  // Offline shop owners remain as dormant owner rows; their shop and sign
  // stay visible with a closed status. Only anonymous visitor avatars are
  // deleted, which also bounds the table to roughly 100 dormant sellers.
  await db
    .delete(players)
    .where(and(lt(players.lastSeenAt, cutoff), isNull(players.boothSlot)));
  activeCache = null;
}

/**
 * A tiny read-through cache coalesces simultaneous heartbeats from many
 * visitors into one PostgreSQL query. Positions can be at most 75ms stale,
 * which is below one network interpolation frame and avoids database stampedes.
 */
export async function getActivePlayers(
  force = false,
  limit = MAX_ACTIVE_PLAYERS,
): Promise<PlayerRow[]> {
  const now = Date.now();
  if (!force && activeCache && now - activeCache.at < 75) return activeCache.rows;
  const cutoff = new Date(now - PLAYER_TIMEOUT_MS);
  const rows = await db
    .select()
    .from(players)
    .where(gt(players.lastSeenAt, cutoff))
    .orderBy(desc(players.createdAt))
    .limit(limit);
  activeCache = { at: now, rows };
  return rows;
}

export function invalidatePlayersCache(): void {
  activeCache = null;
}

export function toPlayerDto(row: PlayerRow): PlayerDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    role: row.role === "seller" ? "seller" : "visitor",
    device: (row.device as DeviceKind) ?? "desktop",
    x: row.x,
    y: row.y,
    dir: (row.dir as Direction) ?? "down",
    moving: row.moving,
    boothSlot: row.boothSlot ?? null,
    gender: row.gender === "female" ? "female" : "male",
  };
}

const ADJECTIVES = ["Swift", "Silent", "Brave", "Lucky", "Neon", "Cosmic", "Golden", "Crimson"];

export function sanitizeName(input: unknown): string {
  if (typeof input === "string") {
    const trimmed = input.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed.length >= 2) return trimmed;
  }
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${Math.floor(1000 + Math.random() * 8999)}`;
}

export function normalizeDevice(input: unknown): DeviceKind {
  return input === "mobile" || input === "tablet" ? input : "desktop";
}

export function normalizeRole(input: unknown): Role {
  return input === "seller" ? "seller" : "visitor";
}

export function normalizeGender(input: unknown): Gender {
  return input === "female" ? "female" : "male";
}

export function normalizeDirection(input: unknown): Direction {
  return input === "up" || input === "down" || input === "left" || input === "right"
    ? input
    : "down";
}

export function pickColor(active: PlayerRow[]): string {
  const used = new Set(active.map((row) => row.color));
  const free = PLAYER_COLORS.filter((color) => !used.has(color));
  const pool = free.length > 0 ? free : PLAYER_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function cleanText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, maxLength);
}

/** Only same-origin uploaded artwork can be used as a sign. */
export function cleanAssetUrl(input: unknown): string {
  if (typeof input !== "string") return "";
  const value = input.trim();
  return /^\/api\/assets\/[0-9a-f-]{36}$/i.test(value) ? value : "";
}

/** New arrivals share the gate plaza without overlapping shop geometry. */
export function pickSpawn(active: PlayerRow[]): { x: number; y: number } {
  const ahead = active.length;
  const lane = ahead % 10;
  const row = Math.floor(ahead / 10);
  const candidates = [
    { x: ENTRANCE_X + (lane - 4.5) * 66, y: ENTRANCE_Y - row * 42 },
    { x: ENTRANCE_X + (lane - 4.5) * 78, y: ENTRANCE_Y + 34 - row * 48 },
    { x: ENTRANCE_X, y: ENTRANCE_Y - 80 - row * 44 },
  ];

  for (const candidate of candidates) {
    const x = Math.min(WORLD_WIDTH - PLAYER_RADIUS * 2, Math.max(PLAYER_RADIUS * 2, candidate.x));
    const y = Math.min(WORLD_HEIGHT - PLAYER_RADIUS * 2, Math.max(PLAYER_RADIUS * 2, candidate.y));
    if (!isBlocked(x, y)) return { x, y };
  }
  return { x: ENTRANCE_X, y: ENTRANCE_Y };
}

export async function findPlayerByIdAndSecret(
  id: unknown,
  secret: unknown,
): Promise<PlayerRow | null> {
  if (typeof id !== "string" || typeof secret !== "string") return null;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(secret)) return null;
  const rows = await db
    .select()
    .from(players)
    .where(and(eq(players.id, id), eq(players.secret, secret)))
    .limit(1);
  return rows[0] ?? null;
}
