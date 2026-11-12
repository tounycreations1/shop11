import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { booths, players, products } from "@/db/schema";
import { MAX_PRODUCTS, boothStandingPoint, isValidSlot } from "@/lib/game/constants";
import {
  findFreeSlot,
  getBoothBySlot,
  getMarketSnapshot,
  invalidateMarketCache,
  listProducts,
  normalizeBoothDraft,
  normalizeProduct,
  takenSlots,
  type ProductInput,
} from "@/lib/game/booths";
import { cleanText, findPlayerByIdAndSecret, invalidatePlayersCache } from "@/lib/game/server";

export const dynamic = "force-dynamic";

/** Market overview: booked spots, live feed and counters. */
export async function GET() {
  try {
    const snapshot = await getMarketSnapshot();
    return Response.json(snapshot);
  } catch (error) {
    console.error("[booths:list] failed", error);
    return Response.json(
      {
        booths: [],
        feed: [],
        stats: { online: 0, visitors: 0, sellers: 0, takenBooths: 0, openBooths: 0 },
      },
      { status: 500 },
    );
  }
}

/**
 * Owner operations on a market spot. Every action requires the seller's own
 * player id + secret, and the body carries an `action` field:
 *
 *   claim | update | live | product.add | product.remove | product.feature | release
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body?.action === "string" ? body.action : "";
    const me = await findPlayerByIdAndSecret(body?.id, body?.secret);

    if (!me) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    /* ------------------------------ claim ------------------------------- */
    if (action === "claim") {
      if (me.boothSlot !== null && (await getBoothBySlot(me.boothSlot))) {
        return Response.json({ error: "already_owns", slot: me.boothSlot }, { status: 409 });
      }

      const draft = normalizeBoothDraft(body);
      if (!draft) {
        return Response.json({ error: "invalid_brand" }, { status: 400 });
      }

      const requested = typeof body?.slot === "number" ? body.slot : null;
      if (requested !== null && !isValidSlot(requested)) {
        return Response.json({ error: "invalid_slot" }, { status: 400 });
      }

      let slot: number | null;
      if (requested !== null) {
        // A specific spot was chosen: it must still be free.
        const taken = await takenSlots();
        if (taken.has(requested)) {
          return Response.json({ error: "slot_taken" }, { status: 409 });
        }
        slot = requested;
      } else {
        slot = await findFreeSlot();
      }

      if (slot === null) {
        return Response.json({ error: "no_free_slot" }, { status: 409 });
      }

      const inserted = await db
        .insert(booths)
        .values({
          slot,
          ownerPlayerId: me.id,
          brandName: draft.brandName,
          category: draft.category,
          tagline: draft.tagline,
          description: draft.description,
          contact: draft.contact,
          emoji: draft.emoji,
          logoUrl: draft.logoUrl,
          color: draft.color,
          avatarGender: draft.avatarGender,
        })
        .onConflictDoNothing({ target: booths.slot })
        .returning();

      const booth = inserted[0];
      if (!booth) {
        return Response.json({ error: "slot_taken" }, { status: 409 });
      }

      // Seed the spot with the products/services the seller typed up-front.
      const rawItems = Array.isArray(body?.products) ? body.products : [];
      const items = rawItems
        .map(normalizeProduct)
        .filter((item): item is ProductInput => item !== null)
        .slice(0, MAX_PRODUCTS);

      if (items.length > 0) {
        await db.insert(products).values(
          items.map((item, index) => ({
            boothId: booth.id,
            kind: item.kind,
            name: item.name,
            price: item.price,
            detail: item.detail,
            featured: index === 0,
          })),
        );
      }

      const standing = boothStandingPoint(slot);
      await db
        .update(players)
        .set({ role: "seller", boothSlot: slot, gender: draft.avatarGender, x: standing.x, y: standing.y })
        .where(eq(players.id, me.id));

      invalidateMarketCache();
      invalidatePlayersCache();
      const snapshot = await getMarketSnapshot();
      return Response.json({ ok: true, slot, boothId: booth.id, ...snapshot }, { status: 201 });
    }

    /* ------------------------- everything else needs a booth ------------ */
    const slot = typeof body?.slot === "number" ? body.slot : me.boothSlot;
    if (slot === null || !isValidSlot(slot)) {
      return Response.json({ error: "no_booth" }, { status: 400 });
    }

    const booth = await getBoothBySlot(slot);
    if (!booth || booth.ownerPlayerId !== me.id) {
      return Response.json({ error: "not_owner" }, { status: 403 });
    }

    if (action === "update") {
      const draft = normalizeBoothDraft(body);
      if (!draft) return Response.json({ error: "invalid_brand" }, { status: 400 });
      await db
        .update(booths)
        .set({
          brandName: draft.brandName,
          category: draft.category,
          tagline: draft.tagline,
          description: draft.description,
          contact: draft.contact,
          emoji: draft.emoji,
          logoUrl: draft.logoUrl,
          color: draft.color,
          avatarGender: draft.avatarGender,
          updatedAt: new Date(),
        })
        .where(eq(booths.id, booth.id));
      // The seller's own walking avatar always matches the chosen representative.
      await db.update(players).set({ gender: draft.avatarGender }).where(eq(players.id, me.id));
    } else if (action === "live") {
      const message = cleanText(body?.message, 70);
      await db
        .update(booths)
        .set({
          liveMessage: message,
          liveUpdatedAt: message ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(booths.id, booth.id));
    } else if (action === "product.add") {
      const existing = await listProducts(booth.id);
      if (existing.length >= MAX_PRODUCTS) {
        return Response.json({ error: "too_many_products" }, { status: 409 });
      }
      const item = normalizeProduct(body);
      if (!item) return Response.json({ error: "invalid_product" }, { status: 400 });
      await db.insert(products).values({
        boothId: booth.id,
        kind: item.kind,
        name: item.name,
        price: item.price,
        detail: item.detail,
        featured: existing.length === 0,
      });
    } else if (action === "product.remove") {
      const productId = typeof body?.productId === "string" ? body.productId : "";
      if (!productId) return Response.json({ error: "invalid_product" }, { status: 400 });
      await db
        .delete(products)
        .where(and(eq(products.id, productId), eq(products.boothId, booth.id)));
    } else if (action === "product.feature") {
      const productId = typeof body?.productId === "string" ? body.productId : "";
      if (!productId) return Response.json({ error: "invalid_product" }, { status: 400 });
      await db.update(products).set({ featured: false }).where(eq(products.boothId, booth.id));
      await db
        .update(products)
        .set({ featured: true })
        .where(and(eq(products.id, productId), eq(products.boothId, booth.id)));
    } else if (action === "release") {
      await db.delete(booths).where(eq(booths.id, booth.id));
      await db
        .update(players)
        .set({ role: "visitor", boothSlot: null })
        .where(eq(players.id, me.id));
    } else {
      return Response.json({ error: "unknown_action" }, { status: 400 });
    }

    invalidateMarketCache();
    invalidatePlayersCache();
    const snapshot = await getMarketSnapshot();
    const detail = await getBoothBySlot(slot);
    return Response.json({
      ok: true,
      slot,
      products: detail ? await listProducts(detail.id) : [],
      ...snapshot,
    });
  } catch (error) {
    console.error("[booths:post] failed", error);
    return Response.json({ error: "booth_failed" }, { status: 500 });
  }
}
