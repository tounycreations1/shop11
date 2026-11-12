import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { booths, players, products, type BoothRow } from "@/db/schema";
import {
  BOOTH_COUNT,
  CATEGORIES,
  MAX_BRAND,
  MAX_DESCRIPTION,
  MAX_PRODUCTS,
  MAX_TAGLINE,
  SHOP_THEMES,
  isValidSlot,
} from "@/lib/game/constants";
import { cleanAssetUrl, cleanText, normalizeGender } from "@/lib/game/server";
import type {
  BoothDetailDto,
  BoothSummary,
  FeedItem,
  Gender,
  MarketStats,
  ProductDto,
  ProductKind,
} from "@/lib/game/types";

type Snapshot = { booths: BoothSummary[]; feed: FeedItem[]; stats: MarketStats };
let cache: { at: number; snapshot: Snapshot } | null = null;

export function invalidateMarketCache(): void {
  cache = null;
}

function isOnline(lastSeen: Date | null): boolean {
  return Boolean(lastSeen && Date.now() - lastSeen.getTime() < 14_000);
}

function themeColor(color: string, slot: number): string {
  return (
    SHOP_THEMES.find((theme) => theme.key === color)?.trim ??
    (color || SHOP_THEMES[slot % SHOP_THEMES.length].trim)
  );
}

/** One grouped query supplies both the offer count and the highlighted offer. */
export async function getMarketSnapshot(activeRoles?: { role: string }[]): Promise<Snapshot> {
  const now = Date.now();
  if (cache && now - cache.at < 650) {
    if (!activeRoles) return cache.snapshot;
    return {
      ...cache.snapshot,
      stats: {
        ...cache.snapshot.stats,
        online: activeRoles.length,
        visitors: activeRoles.filter((row) => row.role !== "seller").length,
        sellers: activeRoles.filter((row) => row.role === "seller").length,
      },
    };
  }

  const [rows, offerRows] = await Promise.all([
    db
      .select({
        id: booths.id,
        slot: booths.slot,
        brand: booths.brandName,
        emoji: booths.emoji,
        category: booths.category,
        color: booths.color,
        logoUrl: booths.logoUrl,
        avatarGender: booths.avatarGender,
        tagline: booths.tagline,
        liveMessage: booths.liveMessage,
        liveUpdatedAt: booths.liveUpdatedAt,
        ownerName: players.name,
        ownerLastSeen: players.lastSeenAt,
      })
      .from(booths)
      .leftJoin(players, eq(booths.ownerPlayerId, players.id))
      .orderBy(asc(booths.slot)),
    db
      .select({
        boothId: products.boothId,
        total: sql<number>`count(*)::int`,
        offerName: sql<string>`(array_agg(${products.name} order by ${products.featured} desc, ${products.createdAt} asc))[1]`,
        offerPrice: sql<string>`(array_agg(${products.price} order by ${products.featured} desc, ${products.createdAt} asc))[1]`,
        offerKind: sql<string>`(array_agg(${products.kind} order by ${products.featured} desc, ${products.createdAt} asc))[1]`,
      })
      .from(products)
      .groupBy(products.boothId),
  ]);

  const offers = new Map(offerRows.map((row) => [row.boothId, row]));
  const summaries: BoothSummary[] = rows.map((row) => {
    const aggregate = offers.get(row.id);
    return {
      slot: row.slot,
      brand: row.brand,
      emoji: row.emoji,
      category: row.category,
      color: themeColor(row.color, row.slot),
      logoUrl: row.logoUrl,
      avatarGender: row.avatarGender === "female" ? "female" : "male",
      tagline: row.tagline,
      open: isOnline(row.ownerLastSeen ?? null),
      liveMessage: row.liveMessage,
      liveAt: row.liveUpdatedAt?.getTime() ?? 0,
      productsCount: Number(aggregate?.total ?? 0),
      ownerName: row.ownerName ?? "—",
      offer: aggregate?.offerName
        ? {
            name: aggregate.offerName,
            price: aggregate.offerPrice ?? "",
            kind: aggregate.offerKind === "service" ? "service" : "product",
          }
        : null,
    };
  });

  const feed: FeedItem[] = rows
    .filter((row) => row.liveMessage.trim().length > 0)
    .sort((a, b) => (b.liveUpdatedAt?.getTime() ?? 0) - (a.liveUpdatedAt?.getTime() ?? 0))
    .slice(0, 8)
    .map((row) => ({
      slot: row.slot,
      brand: row.brand,
      logoUrl: row.logoUrl,
      color: themeColor(row.color, row.slot),
      message: row.liveMessage,
      at: row.liveUpdatedAt?.getTime() ?? 0,
    }));

  const onlinePlayers = activeRoles ?? [];
  const snapshot: Snapshot = {
    booths: summaries,
    feed,
    stats: {
      online: onlinePlayers.length,
      visitors: onlinePlayers.filter((row) => row.role !== "seller").length,
      sellers: onlinePlayers.filter((row) => row.role === "seller").length,
      takenBooths: summaries.length,
      openBooths: summaries.filter((item) => item.open).length,
    },
  };
  cache = { at: now, snapshot };
  return snapshot;
}

export type ProductInput = { kind: ProductKind; name: string; price: string; detail: string };

export function normalizeProduct(input: unknown): ProductInput | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  const name = cleanText(record.name, 44);
  if (name.length < 2) return null;
  return {
    kind: record.kind === "service" ? "service" : "product",
    name,
    price: cleanText(record.price, 24),
    detail: cleanText(record.detail, 160),
  };
}

export function normalizeCategory(input: unknown): string {
  const key = typeof input === "string" ? input : "";
  return CATEGORIES.some((category) => category.key === key) ? key : "other";
}

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

export function normalizeBoothDraft(input: unknown): BoothDraft | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  const brandName = cleanText(record.brandName ?? record.brand, MAX_BRAND);
  if (brandName.length < 2) return null;
  const requestedTheme = typeof record.color === "string" ? record.color : "";
  const theme = SHOP_THEMES.find((item) => item.key === requestedTheme || item.trim === requestedTheme);
  return {
    brandName,
    category: normalizeCategory(record.category),
    tagline: cleanText(record.tagline, MAX_TAGLINE),
    description: cleanText(record.description, MAX_DESCRIPTION),
    contact: cleanText(record.contact, 48),
    emoji: "",
    logoUrl: cleanAssetUrl(record.logoUrl),
    color: theme?.key ?? "teal",
    avatarGender: normalizeGender(record.avatarGender),
  };
}

export async function takenSlots(): Promise<Set<number>> {
  const rows = await db.select({ slot: booths.slot }).from(booths);
  return new Set(rows.map((row) => row.slot));
}

export async function findFreeSlot(preferred?: unknown): Promise<number | null> {
  const taken = await takenSlots();
  if (typeof preferred === "number" && isValidSlot(preferred) && !taken.has(preferred)) return preferred;
  for (let slot = 1; slot <= BOOTH_COUNT; slot += 1) if (!taken.has(slot)) return slot;
  return null;
}

export async function getBoothBySlot(slot: number): Promise<BoothRow | null> {
  const rows = await db.select().from(booths).where(eq(booths.slot, slot)).limit(1);
  return rows[0] ?? null;
}

export async function listProducts(boothId: string): Promise<ProductDto[]> {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.boothId, boothId))
    .orderBy(desc(products.featured), asc(products.createdAt));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind === "service" ? "service" : "product",
    name: row.name,
    price: row.price,
    detail: row.detail,
    featured: row.featured,
  }));
}

export async function buildBoothDetail(
  booth: BoothRow,
  ownerName: string | null,
  ownerLastSeen: Date | null,
): Promise<BoothDetailDto> {
  const items = await listProducts(booth.id);
  const online = isOnline(ownerLastSeen);
  const featured = items[0] ?? null;
  return {
    slot: booth.slot,
    brand: booth.brandName,
    emoji: booth.emoji,
    category: booth.category,
    color: themeColor(booth.color, booth.slot),
    logoUrl: booth.logoUrl,
    avatarGender: booth.avatarGender === "female" ? "female" : "male",
    open: online,
    liveMessage: booth.liveMessage,
    liveAt: booth.liveUpdatedAt?.getTime() ?? 0,
    productsCount: items.length,
    ownerName: ownerName ?? "—",
    tagline: booth.tagline,
    offer: featured ? { name: featured.name, price: featured.price, kind: featured.kind } : null,
    description: booth.description,
    contact: booth.contact,
    visits: booth.visits,
    products: items.slice(0, MAX_PRODUCTS),
    ownerOnline: online,
    updatedAt: booth.updatedAt instanceof Date ? booth.updatedAt.getTime() : 0,
  };
}
