import { eq } from "drizzle-orm";

import { db } from "@/db";
import { players } from "@/db/schema";
import { MAX_NEARBY_PLAYERS, NEARBY_PLAYER_RADIUS, clampToWorld } from "@/lib/game/constants";
import { getMarketSnapshot } from "@/lib/game/booths";
import {
  cleanupStalePlayers,
  findPlayerByIdAndSecret,
  getActivePlayers,
  normalizeDirection,
  toPlayerDto,
} from "@/lib/game/server";
import type { StateResponse } from "@/lib/game/types";

export const dynamic = "force-dynamic";

function toFinite(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

const EMPTY_STATS = { online: 0, visitors: 0, sellers: 0, takenBooths: 0, openBooths: 0 };

/**
 * The world heartbeat. Only nearby avatars are serialized, idle players write
 * once per second instead of every frame, and simultaneous reads are coalesced.
 * This keeps both PostgreSQL and phone CPUs calm as the market gets crowded.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const self = await findPlayerByIdAndSecret(body?.id, body?.secret);
    if (!self) {
      return Response.json({
        expired: true,
        players: [],
        booths: [],
        feed: [],
        stats: EMPTY_STATS,
        serverTime: Date.now(),
      } satisfies StateResponse);
    }

    const x = clampToWorld(toFinite(body?.x, self.x), "x");
    const y = clampToWorld(toFinite(body?.y, self.y), "y");
    const dir = normalizeDirection(body?.dir);
    const moving = body?.moving === true;
    const changed =
      Math.abs(self.x - x) > 0.4 ||
      Math.abs(self.y - y) > 0.4 ||
      self.dir !== dir ||
      self.moving !== moving;
    const needsHeartbeat = Date.now() - self.lastSeenAt.getTime() > 950;

    if (changed || needsHeartbeat) {
      await db
        .update(players)
        .set({ x, y, dir, moving, lastSeenAt: new Date() })
        .where(eq(players.id, self.id));
    }

    await cleanupStalePlayers();
    const active = await getActivePlayers();
    const snapshot = await getMarketSnapshot(active.map((player) => ({ role: player.role })));
    const radiusSquared = NEARBY_PLAYER_RADIUS * NEARBY_PLAYER_RADIUS;

    const payload: StateResponse = {
      // Avatars outside the visible neighbourhood are omitted, not marked as
      // having left; they simply stream back in when the visitor approaches.
      players: active
        .filter(
          (row) =>
            row.id !== self.id &&
            (row.x - x) * (row.x - x) + (row.y - y) * (row.y - y) <= radiusSquared,
        )
        .slice(0, MAX_NEARBY_PLAYERS)
        .map(toPlayerDto),
      booths: snapshot.booths,
      feed: snapshot.feed,
      stats: { ...snapshot.stats, online: active.length },
      serverTime: Date.now(),
    };
    return Response.json(payload);
  } catch (error) {
    console.error("[state] failed", error);
    return Response.json({ error: "state_failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await cleanupStalePlayers();
    const active = await getActivePlayers(true);
    const snapshot = await getMarketSnapshot(active.map((player) => ({ role: player.role })));
    return Response.json({
      players: active.map(toPlayerDto),
      booths: snapshot.booths,
      feed: snapshot.feed,
      stats: { ...snapshot.stats, online: active.length },
    });
  } catch (error) {
    console.error("[state:list] failed", error);
    return Response.json(
      { players: [], booths: [], feed: [], stats: EMPTY_STATS },
      { status: 500 },
    );
  }
}
