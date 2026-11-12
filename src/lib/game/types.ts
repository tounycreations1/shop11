export type Role = "visitor" | "seller";
export type DeviceKind = "desktop" | "mobile" | "tablet";
export type Direction = "up" | "down" | "left" | "right";
export type ProductKind = "product" | "service";
export type Gender = "male" | "female";

export type PlayerDto = {
  id: string;
  name: string;
  color: string;
  role: Role;
  device: DeviceKind;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  boothSlot: number | null;
  gender: Gender;
};

export type SessionPayload = {
  id: string;
  secret: string;
  name: string;
  color: string;
  role: Role;
  device: DeviceKind;
  boothSlot: number | null;
  gender: Gender;
};

export type OfferPreview = {
  name: string;
  price: string;
  kind: ProductKind;
};

/** Compact live shop state broadcast to every nearby browser. */
export type BoothSummary = {
  slot: number;
  brand: string;
  emoji: string;
  category: string;
  color: string;
  logoUrl: string;
  open: boolean;
  liveMessage: string;
  productsCount: number;
  ownerName: string;
  tagline: string;
  offer: OfferPreview | null;
  liveAt: number;
  /** The person the seller chose to stand in front of the shop. */
  avatarGender: Gender;
};

export type ProductDto = {
  id: string;
  kind: ProductKind;
  name: string;
  price: string;
  detail: string;
  featured: boolean;
};

export type BoothDetailDto = BoothSummary & {
  description: string;
  contact: string;
  visits: number;
  products: ProductDto[];
  ownerOnline: boolean;
  updatedAt: number;
};

export type FeedItem = {
  slot: number;
  brand: string;
  logoUrl: string;
  color: string;
  message: string;
  at: number;
};

export type MarketStats = {
  online: number;
  visitors: number;
  sellers: number;
  takenBooths: number;
  openBooths: number;
};

export type JoinResponse = {
  session: SessionPayload;
  x: number;
  y: number;
  players: PlayerDto[];
  booths: BoothSummary[];
  feed: FeedItem[];
  stats: MarketStats;
};

export type StateResponse = {
  expired?: boolean;
  players: PlayerDto[];
  booths: BoothSummary[];
  feed: FeedItem[];
  stats: MarketStats;
  serverTime: number;
};

export type BoothListResponse = {
  booths: BoothSummary[];
  feed: FeedItem[];
  stats: MarketStats;
};

/* --------------------------------- chat ---------------------------------- */

export type ChatMessage = {
  id: string;
  sender: "visitor" | "seller";
  text: string;
  at: number;
};

export type ChatThread = {
  visitorId: string;
  visitorName: string;
  lastText: string;
  lastAt: number;
  unread: number;
};
