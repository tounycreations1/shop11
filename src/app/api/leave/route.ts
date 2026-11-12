import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { players } from "@/db/schema";
import { findPlayerByIdAndSecret, invalidatePlayersCache } from "@/lib/game/server";
import { invalidateMarketCache } from "@/lib/game/booths";

export const dynamic = "force-dynamic";

/**
 * Sent with `navigator.sendBeacon` when a browser leaves the world, so the
 * avatar disappears immediately instead of waiting for the idle timeout.
 * Booked market spots stay booked — only the avatar leaves.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const self = await findPlayerByIdAndSecret(parsed?.id, parsed?.secret);
    if (self) {
      if (self.boothSlot !== null) {
        // Keep ownership, but make the avatar and the shop immediately closed.
        await db
          .update(players)
          .set({
            moving: false,
            lastSeenAt: new Date(Date.now() - 20_000),
          })
          .where(and(eq(players.id, self.id), eq(players.secret, self.secret)));
      } else {
        await db
          .delete(players)
          .where(and(eq(players.id, self.id), eq(players.secret, self.secret)));
      }
      invalidateMarketCache();
      invalidatePlayersCache();
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[leave] failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
