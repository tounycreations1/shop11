import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Every live browser inside the shared market. */
export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    secret: uuid("secret").notNull().defaultRandom(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    role: text("role").notNull().default("visitor"),
    device: text("device").notNull().default("desktop"),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    dir: text("dir").notNull().default("down"),
    moving: boolean("moving").notNull().default(false),
    boothSlot: integer("booth_slot"),
    gender: text("gender").notNull().default("male"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("players_last_seen_at_idx").on(table.lastSeenAt)],
);

/** Only booked shops are stored. slot 1..100 maps to the shared street plan. */
export const booths = pgTable(
  "booths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slot: integer("slot").notNull(),
    ownerPlayerId: uuid("owner_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    brandName: text("brand_name").notNull(),
    category: text("category").notNull().default("other"),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    contact: text("contact").notNull().default(""),
    emoji: text("emoji").notNull().default(""),
    color: text("color").notNull().default("#5eead4"),
    logoUrl: text("logo_url").notNull().default(""),
    avatarGender: text("avatar_gender").notNull().default("male"),
    liveMessage: text("live_message").notNull().default(""),
    liveUpdatedAt: timestamp("live_updated_at", { withTimezone: true }),
    visits: integer("visits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booths_slot_unique").on(table.slot),
    index("booths_owner_idx").on(table.ownerPlayerId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boothId: uuid("booth_id")
      .notNull()
      .references(() => booths.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("product"),
    name: text("name").notNull(),
    price: text("price").notNull().default(""),
    detail: text("detail").notNull().default(""),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("products_booth_idx").on(table.boothId)],
);

/** Visitor <-> seller conversations held at the shop's representative. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boothId: uuid("booth_id")
      .notNull()
      .references(() => booths.id, { onDelete: "cascade" }),
    visitorId: uuid("visitor_id").notNull(),
    visitorName: text("visitor_name").notNull(),
    sender: text("sender").notNull().default("visitor"),
    body: text("body").notNull(),
    readBySeller: boolean("read_by_seller").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_booth_visitor_idx").on(table.boothId, table.visitorId, table.createdAt),
  ],
);

/**
 * Uploaded sign artwork is persisted in PostgreSQL rather than the ephemeral
 * web filesystem, so it survives rebuilds and works from every device.
 */
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlayerRow = typeof players.$inferSelect;
export type BoothRow = typeof booths.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
