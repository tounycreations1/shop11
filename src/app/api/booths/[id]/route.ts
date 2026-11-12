import { eq } from "drizzle-orm";

import { db } from "@/db";
import { booths, players } from "@/db/schema";
import { isValidSlot } from "@/lib/game/constants";
import { buildBoothDetail, getBoothBySlot } from "@/lib/game/booths";
import { cleanText } from "@/lib/game/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What a visitor sees after tapping a seller's sign: the brand, what it sells,
 * the services it provides and its live broadcast.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const slot = Number(id);
    if (!Number.isInteger(slot) || !isValidSlot(slot)) {
      return Response.json({ error: "invalid_slot" }, { status: 400 });
    }

    const booth = await getBoothBySlot(slot);
    if (!booth) {
      return Response.json({ error: "free_slot", slot }, { status: 404 });
    }

    const owners = await db
      .select({ name: players.name, lastSeenAt: players.lastSeenAt })
      .from(players)
      .where(eq(players.id, booth.ownerPlayerId))
      .limit(1);

    const detail = await buildBoothDetail(
      booth,
      owners[0]?.name ?? null,
      owners[0]?.lastSeenAt ?? null,
    );

    // Only the initial open counts. The five-second live refresh must not
    // manufacture extra views for a visitor who leaves the panel open.
    if (new URL(request.url).searchParams.get("visit") === "1") {
      void db
        .update(booths)
        .set({ visits: booth.visits + 1 })
        .where(eq(booths.id, booth.id))
        .catch(() => undefined);
    }

    return Response.json({ booth: detail });
  } catch (error) {
    console.error("[booth:detail] failed", error);
    return Response.json({ error: "detail_failed" }, { status: 500 });
  }
}

/** Owner-only read used by the seller dashboard. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const slot = Number(id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (!Number.isInteger(slot) || !isValidSlot(slot)) {
      return Response.json({ error: "invalid_slot" }, { status: 400 });
    }
    if (
      typeof body?.id !== "string" ||
      typeof body?.secret !== "string" ||
      !UUID_PATTERN.test(body.id) ||
      !UUID_PATTERN.test(body.secret)
    ) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const booth = await getBoothBySlot(slot);
    if (!booth) return Response.json({ error: "free_slot" }, { status: 404 });

    const owners = await db
      .select({ id: players.id, name: players.name, lastSeenAt: players.lastSeenAt })
      .from(players)
      .where(eq(players.id, booth.ownerPlayerId))
      .limit(1);

    const owner = owners[0];
    if (!owner || owner.id !== body.id) {
      return Response.json({ error: "not_owner" }, { status: 403 });
    }

    const detail = await buildBoothDetail(booth, owner.name, owner.lastSeenAt);
    return Response.json({
      booth: detail,
      secretOk: booth.ownerPlayerId === body.id,
      message: cleanText(body?.message, 1),
    });
  } catch (error) {
    console.error("[booth:owner] failed", error);
    return Response.json({ error: "owner_failed" }, { status: 500 });
  }
}
