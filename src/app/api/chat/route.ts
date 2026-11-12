import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { messages } from "@/db/schema";
import { MAX_CHAT_LENGTH, isValidSlot } from "@/lib/game/constants";
import { getBoothBySlot } from "@/lib/game/booths";
import { cleanText, findPlayerByIdAndSecret } from "@/lib/game/server";
import type { ChatMessage, ChatThread } from "@/lib/game/types";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEEP_DAYS = 7;

function toDto(row: typeof messages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    sender: row.sender === "seller" ? "seller" : "visitor",
    text: row.body,
    at: row.createdAt.getTime(),
  };
}

/**
 * Chat between visitors and the seller standing in front of a shop. Every call
 * is authenticated with the caller's own player id + secret.
 *
 *   visitor: send | list           (slot)
 *   seller:  threads | thread | reply | unread
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body?.action === "string" ? body.action : "";
    const me = await findPlayerByIdAndSecret(body?.id, body?.secret);
    if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

    /* --------------------------- seller side --------------------------- */
    if (action === "threads" || action === "thread" || action === "reply" || action === "unread") {
      if (me.boothSlot === null) return Response.json({ error: "no_booth" }, { status: 403 });
      const booth = await getBoothBySlot(me.boothSlot);
      if (!booth || booth.ownerPlayerId !== me.id) {
        return Response.json({ error: "not_owner" }, { status: 403 });
      }

      if (action === "unread") {
        const rows = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(eq(messages.boothId, booth.id), eq(messages.sender, "visitor"), eq(messages.readBySeller, false)),
          );
        return Response.json({ unread: Number(rows[0]?.total ?? 0) });
      }

      if (action === "threads") {
        const rows = await db
          .select()
          .from(messages)
          .where(eq(messages.boothId, booth.id))
          .orderBy(desc(messages.createdAt))
          .limit(300);
        const map = new Map<string, ChatThread>();
        for (const row of rows) {
          let thread = map.get(row.visitorId);
          if (!thread) {
            thread = {
              visitorId: row.visitorId,
              visitorName: row.visitorName,
              lastText: row.body,
              lastAt: row.createdAt.getTime(),
              unread: 0,
            };
            map.set(row.visitorId, thread);
          }
          if (row.sender === "visitor" && !row.readBySeller) thread.unread += 1;
        }
        return Response.json({ threads: [...map.values()] });
      }

      const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
      if (!UUID_PATTERN.test(visitorId)) return Response.json({ error: "invalid_visitor" }, { status: 400 });

      if (action === "reply") {
        const text = cleanText(body?.text, MAX_CHAT_LENGTH);
        if (!text) return Response.json({ error: "empty" }, { status: 400 });
        const last = await db
          .select({ name: messages.visitorName })
          .from(messages)
          .where(and(eq(messages.boothId, booth.id), eq(messages.visitorId, visitorId)))
          .limit(1);
        if (!last[0]) return Response.json({ error: "no_thread" }, { status: 404 });
        await db.insert(messages).values({
          boothId: booth.id,
          visitorId,
          visitorName: last[0].name,
          sender: "seller",
          body: text,
          readBySeller: true,
        });
      }

      // thread + reply both return the full conversation and mark it as read.
      await db
        .update(messages)
        .set({ readBySeller: true })
        .where(
          and(eq(messages.boothId, booth.id), eq(messages.visitorId, visitorId), eq(messages.readBySeller, false)),
        );
      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.boothId, booth.id), eq(messages.visitorId, visitorId)))
        .orderBy(asc(messages.createdAt))
        .limit(150);
      return Response.json({ messages: rows.map(toDto) });
    }

    /* -------------------------- visitor side --------------------------- */
    const slot = typeof body?.slot === "number" ? body.slot : NaN;
    if (!isValidSlot(slot)) return Response.json({ error: "invalid_slot" }, { status: 400 });
    const booth = await getBoothBySlot(slot);
    if (!booth) return Response.json({ error: "free_slot" }, { status: 404 });
    if (booth.ownerPlayerId === me.id) return Response.json({ error: "own_booth" }, { status: 400 });

    if (action === "send") {
      const text = cleanText(body?.text, MAX_CHAT_LENGTH);
      if (!text) return Response.json({ error: "empty" }, { status: 400 });

      const recent = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.visitorId, me.id),
            eq(messages.sender, "visitor"),
            gt(messages.createdAt, new Date(Date.now() - 10_000)),
          ),
        );
      if (Number(recent[0]?.total ?? 0) >= 5) {
        return Response.json({ error: "too_fast" }, { status: 429 });
      }

      await db.insert(messages).values({
        boothId: booth.id,
        visitorId: me.id,
        visitorName: me.name,
        sender: "visitor",
        body: text,
      });
      // Opportunistic housekeeping keeps the table small.
      void db
        .delete(messages)
        .where(and(eq(messages.boothId, booth.id), lt(messages.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000))))
        .catch(() => undefined);
    } else if (action !== "list") {
      return Response.json({ error: "unknown_action" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.boothId, booth.id), eq(messages.visitorId, me.id)))
      .orderBy(asc(messages.createdAt))
      .limit(100);
    return Response.json({ messages: rows.map(toDto) });
  } catch (error) {
    console.error("[chat] failed", error);
    return Response.json({ error: "chat_failed" }, { status: 500 });
  }
}

