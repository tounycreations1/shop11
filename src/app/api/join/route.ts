import { eq } from "drizzle-orm";

import { db } from "@/db";
import { players, type PlayerRow } from "@/db/schema";
import { boothStandingPoint, isValidSlot } from "@/lib/game/constants";
import { getMarketSnapshot, invalidateMarketCache } from "@/lib/game/booths";
import {
  cleanupStalePlayers,
  findPlayerByIdAndSecret,
  getActivePlayers,
  invalidatePlayersCache,
  normalizeDevice,
  normalizeGender,
  normalizeRole,
  pickColor,
  pickSpawn,
  sanitizeName,
  toPlayerDto,
} from "@/lib/game/server";

export const dynamic = "force-dynamic";

async function payloadFor(row: PlayerRow, active: PlayerRow[]) {
  const snapshot = await getMarketSnapshot(active.map((player) => ({ role: player.role })));
  return {
    session: {
      id: row.id,
      secret: row.secret,
      name: row.name,
      color: row.color,
      role: row.role === "seller" ? "seller" as const : "visitor" as const,
      device: row.device,
      boothSlot: row.boothSlot ?? null,
      gender: row.gender === "female" ? "female" as const : "male" as const,
    },
    x: row.x,
    y: row.y,
    players: active.filter((player) => player.id !== row.id).map(toPlayerDto),
    booths: snapshot.booths,
    feed: snapshot.feed,
    stats: { ...snapshot.stats, online: active.length },
  };
}

/** Enter the shared market, or resume a seller's existing offline shop. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await cleanupStalePlayers(true);

    const role = normalizeRole(body?.role);
    const name = sanitizeName(body?.name);
    const device = normalizeDevice(body?.device);
    const gender = normalizeGender(body?.gender);

    // The seller credential stays only on their own device. Resuming revives
    // the original owner row, so the 100 shops survive closed laptops/tabs.
    if (role === "seller" && body?.resumeId && body?.resumeSecret) {
      const existing = await findPlayerByIdAndSecret(body.resumeId, body.resumeSecret);
      if (existing?.role === "seller") {
        const spawn = existing.boothSlot !== null && isValidSlot(existing.boothSlot)
          ? boothStandingPoint(existing.boothSlot)
          : pickSpawn(await getActivePlayers(true));
        const updated = await db
          .update(players)
          .set({ name, device, x: spawn.x, y: spawn.y, moving: false, lastSeenAt: new Date() })
          .where(eq(players.id, existing.id))
          .returning();
        invalidatePlayersCache();
        invalidateMarketCache();
        const active = await getActivePlayers(true);
        return Response.json(await payloadFor(updated[0], active));
      }
    }

    const active = await getActivePlayers(true);
    const requestedSlot = role === "seller" && typeof body?.boothSlot === "number" && isValidSlot(body.boothSlot)
      ? body.boothSlot
      : null;
    const spawn = requestedSlot !== null ? boothStandingPoint(requestedSlot) : pickSpawn(active);
    const inserted = await db
      .insert(players)
      .values({ name, device, gender, color: pickColor(active), role, x: spawn.x, y: spawn.y, boothSlot: requestedSlot })
      .returning();
    invalidatePlayersCache();
    const refreshed = await getActivePlayers(true);
    return Response.json(await payloadFor(inserted[0], refreshed), { status: 201 });
  } catch (error) {
    console.error("[join] failed", error);
    return Response.json({ error: "join_failed" }, { status: 500 });
  }
}
