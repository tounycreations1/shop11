import {
  BOOTH_COLS,
  BOOTH_H,
  BOOTH_ROWS,
  BOOTH_W,
  DOOR_W,
  ENTRANCE_X,
  ENTRANCE_Y,
  ORIGIN_X,
  ORIGIN_Y,
  PITCH_X,
  PITCH_Y,
  ROAD_COLOR,
  SHOP_THEMES,
  STAND_GAP,
  STAND_H,
  STAND_W,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_NAMES,
  ZONE_NAMES_AR,
  ZONE_ROWS,
  boothRect,
  boothRepPoint,
  boothStandingPoint,
  doorOnRight,
  shopThemeFor,
} from "@/lib/game/constants";
import type { DeviceKind, Direction, Gender, OfferPreview, Role } from "@/lib/game/types";

export type RenderPlayer = {
  id: string;
  name: string;
  color: string;
  role: Role;
  device: DeviceKind;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  walkPhase: number;
  joinProgress: number;
  boothSlot: number | null;
  gender: Gender;
};

export type RenderBooth = {
  slot: number;
  brand: string;
  color: string;
  category: string;
  logoUrl: string;
  open: boolean;
  liveMessage: string;
  productsCount: number;
  ownerName: string;
  avatarGender: Gender;
  offer: OfferPreview | null;
  /** Nobody rents this unit: the building is drawn, only the sign is blank. */
  vacant?: boolean;
};

export type SceneView = { width: number; height: number; cameraX: number; cameraY: number; time: number };
export type SceneOptions = {
  localId: string;
  targetSlot: number | null;
  selectedSlot: number | null;
  highDetail: boolean;
};

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif';
const signImages = new Map<string, HTMLImageElement>();
const vacantUnits = new Map<number, RenderBooth>();

/** A fully built shop whose sign is empty ("متاح للإيجار"). */
export function vacantBooth(slot: number): RenderBooth {
  let unit = vacantUnits.get(slot);
  if (!unit) {
    unit = {
      slot, brand: "", color: SHOP_THEMES[5].trim, category: "other", logoUrl: "", open: false,
      liveMessage: "", productsCount: 0, ownerName: "", avatarGender: "male", offer: null, vacant: true,
    };
    vacantUnits.set(slot, unit);
  }
  return unit;
}

function getSignImage(url: string): HTMLImageElement | null {
  if (!url || typeof Image === "undefined") return null;
  const cached = signImages.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  signImages.set(url, image);
  return null;
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
  return `${output}…`;
}

function easeOutBack(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/* --------------------------------- street -------------------------------- */

function drawFloor(ctx: CanvasRenderingContext2D, view: SceneView, highDetail: boolean): void {
  const { width, height, cameraX, cameraY } = view;
  const left = -cameraX;
  const top = -cameraY;

  // Outside the street, then one plain navy-blue road: no tiles, no inlays.
  ctx.fillStyle = "#050f26";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = ROAD_COLOR;
  ctx.fillRect(left, top, WORLD_WIDTH, WORLD_HEIGHT);

  // Arcade names stay as faint road lettering so visitors can still orient.
  ctx.save();
  ctx.translate(left, top);
  for (let zone = 0; zone < ZONE_NAMES.length; zone += 1) {
    const zoneY = ORIGIN_Y + zone * ZONE_ROWS * PITCH_Y - 44;
    const zoneH = ZONE_ROWS * PITCH_Y - 36;
    const labelY = zoneY + zoneH - 25;
    if (labelY > cameraY - 50 && labelY < cameraY + height + 50) {
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(226,232,240,.2)";
      ctx.fillText(`رواق ${ZONE_NAMES_AR[zone]}  •  ${ZONE_NAMES[zone]}`, WORLD_WIDTH / 2, labelY);
    }
  }
  ctx.restore();

  // Street lamps and suspended lights, only in the visible neighbourhood.
  if (highDetail) drawStreetLights(ctx, view);

  const gateX = ENTRANCE_X - cameraX;
  const gateY = ENTRANCE_Y - cameraY + 35;
  if (gateX > -250 && gateX < width + 250 && gateY > -180 && gateY < height + 180) {
    ctx.save();
    const glow = ctx.createRadialGradient(gateX, gateY - 60, 4, gateX, gateY - 60, 180);
    glow.addColorStop(0, "rgba(245,158,11,.16)");
    glow.addColorStop(1, "rgba(245,158,11,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(gateX - 180, gateY - 200, 360, 240);
    ctx.strokeStyle = "#a97d3c";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(gateX - 132, gateY);
    ctx.lineTo(gateX - 132, gateY - 70);
    ctx.quadraticCurveTo(gateX, gateY - 150, gateX + 132, gateY - 70);
    ctx.lineTo(gateX + 132, gateY);
    ctx.stroke();
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5d78b";
    ctx.fillText("فرشة", gateX, gateY - 84);
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = "rgba(245,215,139,.65)";
    ctx.fillText("F A R S H A   M A R K E T", gateX, gateY - 64);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(117,155,190,.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();
}

function drawStreetLights(ctx: CanvasRenderingContext2D, view: SceneView): void {
  const rowStart = Math.max(0, Math.floor((view.cameraY - ORIGIN_Y) / PITCH_Y) - 1);
  const rowEnd = Math.min(BOOTH_ROWS - 1, Math.ceil((view.cameraY + view.height - ORIGIN_Y) / PITCH_Y));
  ctx.save();
  for (let row = rowStart; row <= rowEnd; row += 2) {
    const worldY = ORIGIN_Y + row * PITCH_Y + BOOTH_H + 54;
    const y = worldY - view.cameraY;
    const startX = Math.max(40, view.cameraX - 60);
    const endX = Math.min(WORLD_WIDTH - 40, view.cameraX + view.width + 60);
    ctx.strokeStyle = "rgba(15,23,42,.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX - view.cameraX, y - 20);
    ctx.quadraticCurveTo((startX + endX) / 2 - view.cameraX, y + 12, endX - view.cameraX, y - 20);
    ctx.stroke();
    for (let x = Math.ceil(startX / 150) * 150; x < endX; x += 150) {
      const sx = x - view.cameraX;
      const sy = y - 5 + Math.sin((x / Math.max(1, endX - startX)) * Math.PI) * 15;
      const flicker = 0.82 + Math.sin(view.time / 350 + x) * 0.08;
      const glow = ctx.createRadialGradient(sx, sy, 1, sx, sy, 24);
      glow.addColorStop(0, `rgba(255,218,140,${0.35 * flicker})`);
      glow.addColorStop(1, "rgba(255,190,80,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 24, sy - 24, 48, 48);
      ctx.fillStyle = "#ffe0a3";
      ctx.beginPath();
      ctx.arc(sx, sy, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ------------------------------- shop units ------------------------------- */

function drawGlassWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  open: boolean,
  seed: number,
): void {
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, open ? "#57462d" : "#14212a");
  glass.addColorStop(0.5, open ? "#bd9250" : "#1e303b");
  glass.addColorStop(1, open ? "#332d27" : "#0d1922");
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.strokeStyle = "rgba(210,226,230,.32)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Interior shelves and individual product silhouettes.
  ctx.fillStyle = open ? "rgba(40,28,20,.62)" : "rgba(4,12,18,.55)";
  for (let shelf = 0; shelf < 2; shelf += 1) {
    const shelfY = y + h * (0.47 + shelf * 0.31);
    ctx.fillRect(x + 5, shelfY, w - 10, 3);
    for (let item = 0; item < 4; item += 1) {
      const itemW = 5 + ((seed + item * 7 + shelf) % 5);
      const itemH = 9 + ((seed + item * 3) % 9);
      const itemX = x + 8 + item * ((w - 20) / 4);
      ctx.fillRect(itemX, shelfY - itemH, itemW, itemH);
    }
  }

  // Glass reflection.
  ctx.fillStyle = "rgba(210,240,250,.10)";
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 4);
  ctx.lineTo(x + w * 0.55, y + 4);
  ctx.lineTo(x + w * 0.25, y + h - 4);
  ctx.lineTo(x + 5, y + h - 4);
  ctx.closePath();
  ctx.fill();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxWidth) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept.map((item) => truncate(ctx, item, maxWidth));
  }
  return lines.map((item) => truncate(ctx, item, maxWidth));
}

/**
 * The seller's live broadcast is painted as a sticker on the shop glass, next
 * to the door. It is the only place the announcement appears in the market.
 */
function drawWindowOffer(
  ctx: CanvasRenderingContext2D,
  message: string,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const pad = 6;
  const innerW = w - pad * 2 - 8;
  ctx.save();
  ctx.font = `700 10px ${FONT}`;
  const lines = wrapLines(ctx, message, innerW, Math.max(1, Math.floor((h - 34) / 12.5)));
  const boxH = 16 + lines.length * 12.5 + 7;
  const boxX = x + pad;
  const boxY = y + 4;
  const boxW = w - pad * 2;

  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fillStyle = "rgba(14,20,30,.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(251,113,133,.85)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  const pulse = 0.65 + Math.sin(time / 260) * 0.3;
  ctx.fillStyle = `rgba(251,113,133,${pulse})`;
  ctx.beginPath();
  ctx.arc(boxX + boxW - 10, boxY + 8.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `800 8px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fda4af";
  ctx.fillText("عرض مباشر", boxX + boxW - 16, boxY + 9);

  ctx.font = `700 10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff1f2";
  lines.forEach((line, index) => {
    ctx.fillText(line, boxX + boxW / 2, boxY + 16 + 6.5 + index * 12.5);
  });
  ctx.restore();
}

function drawSign(
  ctx: CanvasRenderingContext2D,
  booth: RenderBooth,
  x: number,
  y: number,
  w: number,
  theme: ReturnType<typeof shopThemeFor>,
  time: number,
): void {
  const signX = x - 7;
  const signY = y - 47;
  const signW = w + 14;
  const signH = 43;

  // Brackets, shadow, metal frame.
  ctx.fillStyle = "rgba(3,7,12,.45)";
  roundRect(ctx, signX + 4, signY + 7, signW, signH, 7);
  ctx.fill();
  ctx.fillStyle = "#17212a";
  ctx.fillRect(x + 18, signY + signH, 4, 15);
  ctx.fillRect(x + w - 22, signY + signH, 4, 15);

  roundRect(ctx, signX, signY, signW, signH, 7);
  const frame = ctx.createLinearGradient(signX, signY, signX, signY + signH);
  frame.addColorStop(0, "#e2d2ac");
  frame.addColorStop(0.18, "#6d6251");
  frame.addColorStop(1, "#242b30");
  ctx.fillStyle = frame;
  ctx.fill();
  roundRect(ctx, signX + 3, signY + 3, signW - 6, signH - 6, 4);
  ctx.fillStyle = "#0b141c";
  ctx.fill();

  if (booth.vacant) {
    // Empty sign board: only this notice is missing from an otherwise real shop.
    ctx.save();
    roundRect(ctx, signX + 8, signY + 8, signW - 16, signH - 16, 3);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(245,215,139,.38)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    const glow = 0.82 + Math.sin(time / 500 + booth.slot) * 0.14;
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(245,215,139,${glow})`;
    ctx.fillText("متاح للإيجار", signX + signW / 2, signY + signH / 2 + 1);
    ctx.restore();
    return;
  }

  const image = getSignImage(booth.logoUrl);
  if (image) {
    ctx.save();
    roundRect(ctx, signX + 3, signY + 3, signW - 6, signH - 6, 4);
    ctx.clip();
    const targetW = signW - 6;
    const targetH = signH - 6;
    const scale = Math.max(targetW / image.naturalWidth, targetH / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    ctx.drawImage(image, signX + 3 + (targetW - drawW) / 2, signY + 3 + (targetH - drawH) / 2, drawW, drawH);
    ctx.restore();
  } else {
    // Designed monogram, not a generic emoji placeholder.
    ctx.fillStyle = theme.trim;
    ctx.beginPath();
    ctx.arc(signX + 24, signY + signH / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#102027";
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(booth.brand.trim().charAt(0) || "F", signX + 24, signY + signH / 2 + 1);
    ctx.font = `750 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4f0e6";
    ctx.fillText(truncate(ctx, booth.brand, signW - 62), signX + signW / 2 + 12, signY + signH / 2 + 1);
  }

  if (booth.open) {
    const pulse = 0.8 + Math.sin(time / 260) * 0.15;
    ctx.fillStyle = `rgba(52,211,153,${pulse})`;
    ctx.beginPath();
    ctx.arc(signX + signW - 10, signY + 9, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The seller's single chosen product, displayed on the pavement beside the shop. */
function drawProductStand(
  ctx: CanvasRenderingContext2D,
  offer: OfferPreview,
  x: number,
  y: number,
  rect: { w: number; h: number },
  theme: ReturnType<typeof shopThemeFor>,
  time: number,
): void {
  const sx = x + rect.w + STAND_GAP;
  const top = y + rect.h - STAND_H + 6;
  const cx = sx + STAND_W / 2;

  ctx.save();
  ctx.fillStyle = "rgba(2,6,12,.42)";
  ctx.beginPath();
  ctx.ellipse(cx, top + STAND_H - 1, 31, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Easel legs.
  ctx.strokeStyle = "#33414d";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx + 14, top + 60);
  ctx.lineTo(sx + 9, top + STAND_H - 3);
  ctx.moveTo(sx + STAND_W - 14, top + 60);
  ctx.lineTo(sx + STAND_W - 9, top + STAND_H - 3);
  ctx.stroke();

  // Card.
  roundRect(ctx, sx, top, STAND_W, 64, 8);
  ctx.fillStyle = "#0d1823";
  ctx.fill();
  ctx.strokeStyle = theme.trim;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Icon tile.
  roundRect(ctx, sx + 6, top + 6, STAND_W - 12, 21, 5);
  ctx.fillStyle = `${theme.trim}30`;
  ctx.fill();
  ctx.strokeStyle = theme.light;
  ctx.lineWidth = 1.4;
  const iy = top + 16.5;
  ctx.beginPath();
  if (offer.kind === "service") {
    // four-point spark
    ctx.moveTo(cx, iy - 8); ctx.lineTo(cx + 2.4, iy - 2.4); ctx.lineTo(cx + 8, iy);
    ctx.lineTo(cx + 2.4, iy + 2.4); ctx.lineTo(cx, iy + 8); ctx.lineTo(cx - 2.4, iy + 2.4);
    ctx.lineTo(cx - 8, iy); ctx.lineTo(cx - 2.4, iy - 2.4); ctx.closePath();
  } else {
    // little parcel
    ctx.moveTo(cx - 8, iy - 3); ctx.lineTo(cx, iy - 7.5); ctx.lineTo(cx + 8, iy - 3);
    ctx.lineTo(cx + 8, iy + 4); ctx.lineTo(cx, iy + 8); ctx.lineTo(cx - 8, iy + 4); ctx.closePath();
    ctx.moveTo(cx - 8, iy - 3); ctx.lineTo(cx, iy + 1.5); ctx.lineTo(cx + 8, iy - 3);
    ctx.moveTo(cx, iy + 1.5); ctx.lineTo(cx, iy + 8);
  }
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `750 9.5px ${FONT}`;
  ctx.fillStyle = "#f1f5f9";
  ctx.fillText(truncate(ctx, offer.name, STAND_W - 8), cx, top + 37);
  if (offer.price) {
    ctx.font = `800 9px ${FONT}`;
    ctx.fillStyle = "#fcd34d";
    ctx.fillText(truncate(ctx, offer.price, STAND_W - 8), cx, top + 51);
  }

  // "المزيد" pill — opens the rest of the products.
  const pulse = 0.88 + Math.sin(time / 420) * 0.12;
  roundRect(ctx, sx + 4, top + 68, STAND_W - 8, 17, 8.5);
  ctx.fillStyle = theme.trim;
  ctx.globalAlpha = pulse;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `800 9.5px ${FONT}`;
  ctx.fillStyle = "#0b141c";
  ctx.fillText("المزيد", cx + 4, top + 77);
  ctx.strokeStyle = "#0b141c";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sx + 17.5, top + 73.5);
  ctx.lineTo(sx + 13.5, top + 77);
  ctx.lineTo(sx + 17.5, top + 80.5);
  ctx.stroke();
  ctx.restore();
}

function drawBooth(ctx: CanvasRenderingContext2D, booth: RenderBooth, view: SceneView, options: SceneOptions): void {
  const rect = boothRect(booth.slot);
  const x = rect.x - view.cameraX;
  const y = rect.y - view.cameraY;
  const theme = booth.vacant ? SHOP_THEMES[5] : shopThemeFor(booth.slot, booth.color);
  const style = booth.slot % 4;
  const isTarget = options.targetSlot === booth.slot;

  ctx.save();

  // Broad contact shadow grounds the building on the pavement.
  ctx.fillStyle = "rgba(1,5,16,.45)";
  ctx.beginPath();
  ctx.ellipse(x + rect.w / 2 + 10, y + rect.h + 12, rect.w * 0.62, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isTarget) {
    const pulse = 0.6 + Math.sin(view.time / 220) * 0.25;
    ctx.strokeStyle = `rgba(250,204,21,${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -view.time / 35;
    roundRect(ctx, x - 17, y - 59, rect.w + 34, rect.h + 80, 14);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Right side wall and roof give the shop real architectural depth.
  ctx.fillStyle = "#101a22";
  ctx.beginPath();
  ctx.moveTo(x + rect.w, y + 18);
  ctx.lineTo(x + rect.w + 14, y + 7);
  ctx.lineTo(x + rect.w + 14, y + rect.h - 12);
  ctx.lineTo(x + rect.w, y + rect.h);
  ctx.closePath();
  ctx.fill();

  const wall = ctx.createLinearGradient(x, y + 10, x, y + rect.h);
  wall.addColorStop(0, theme.wall);
  wall.addColorStop(1, "#15212a");
  ctx.fillStyle = wall;
  roundRect(ctx, x, y + 13, rect.w, rect.h - 13, 4);
  ctx.fill();

  // Stone courses and cornice.
  ctx.strokeStyle = "rgba(230,240,240,.08)";
  ctx.lineWidth = 1;
  for (let line = 0; line < 3; line += 1) {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 42 + line * 38);
    ctx.lineTo(x + rect.w - 3, y + 42 + line * 38);
    ctx.stroke();
  }
  ctx.fillStyle = theme.trim;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x - 5, y + 9, rect.w + 15, 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#27333a";
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 10);
  ctx.lineTo(x + 12, y - 1);
  ctx.lineTo(x + rect.w + 12, y - 1);
  ctx.lineTo(x + rect.w + 19, y + 10);
  ctx.closePath();
  ctx.fill();

  const rightDoor = doorOnRight(booth.slot);
  const doorW = DOOR_W;
  const doorX = rightDoor ? x + rect.w - doorW - 12 : x + 12;
  const windowX = rightDoor ? x + 12 : x + 12 + doorW + 10;
  const windowW = rect.w - doorW - 46;
  const windowY = y + 77;
  const windowH = rect.h - 91;

  drawGlassWindow(ctx, windowX, windowY, windowW, windowH, booth.open, booth.slot);
  if (booth.liveMessage && booth.open) {
    drawWindowOffer(ctx, booth.liveMessage, windowX, windowY, windowW, windowH, view.time);
  }

  // Framed door with handle and a small transom window.
  const doorGradient = ctx.createLinearGradient(doorX, windowY, doorX + doorW, y + rect.h);
  doorGradient.addColorStop(0, style === 1 ? "#5f4129" : "#17313c");
  doorGradient.addColorStop(1, "#0b151c");
  ctx.fillStyle = doorGradient;
  roundRect(ctx, doorX, windowY - (style === 1 ? 11 : 0), doorW, windowH + (style === 1 ? 11 : 0), style === 1 ? 18 : 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(220,232,230,.34)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(190,225,235,.12)";
  ctx.fillRect(doorX + 6, windowY + 7, doorW - 12, 27);
  ctx.fillStyle = "#d6b778";
  ctx.beginPath();
  ctx.arc(doorX + (rightDoor ? 8 : doorW - 8), windowY + 53, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Fabric awning with alternating panels and a scalloped valance.
  const awningY = y + 52;
  const awningH = 25;
  const awningGradient = ctx.createLinearGradient(x, awningY, x, awningY + awningH);
  awningGradient.addColorStop(0, theme.awning);
  awningGradient.addColorStop(1, "#18232b");
  ctx.fillStyle = awningGradient;
  ctx.beginPath();
  ctx.moveTo(x + 4, awningY);
  ctx.lineTo(x + rect.w - 4, awningY);
  ctx.lineTo(x + rect.w + 4, awningY + awningH - 7);
  ctx.lineTo(x - 4, awningY + awningH - 7);
  ctx.closePath();
  ctx.fill();
  const panels = 8;
  for (let panel = 0; panel < panels; panel += 2) {
    ctx.fillStyle = "rgba(239,231,210,.62)";
    const panelW = rect.w / panels;
    ctx.beginPath();
    ctx.moveTo(x + panel * panelW, awningY);
    ctx.lineTo(x + (panel + 1) * panelW, awningY);
    ctx.lineTo(x + (panel + 1) * panelW + 2, awningY + awningH - 7);
    ctx.lineTo(x + panel * panelW - 2, awningY + awningH - 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = theme.awning;
  for (let scallop = 0; scallop < 10; scallop += 1) {
    ctx.beginPath();
    ctx.arc(x + scallop * (rect.w / 10) + rect.w / 20, awningY + awningH - 7, rect.w / 20, 0, Math.PI);
    ctx.fill();
  }

  drawSign(ctx, booth, x, y, rect.w, theme, view.time);

  // Brass unit number and outdoor planter.
  ctx.fillStyle = "#d2b77b";
  ctx.font = `700 8px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(String(booth.slot).padStart(3, "0"), x + rect.w / 2, y + 41);

  if (options.highDetail) {
    const planterX = x - 6;
    const planterY = y + rect.h - 25;
    ctx.fillStyle = "#67523a";
    ctx.beginPath();
    ctx.moveTo(planterX - 8, planterY);
    ctx.lineTo(planterX + 8, planterY);
    ctx.lineTo(planterX + 5, planterY + 19);
    ctx.lineTo(planterX - 5, planterY + 19);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#39705b";
    ctx.lineWidth = 3;
    for (let leaf = 0; leaf < 5; leaf += 1) {
      ctx.beginPath();
      ctx.moveTo(planterX, planterY + 2);
      ctx.quadraticCurveTo(planterX + (leaf - 2) * 7, planterY - 16, planterX + (leaf - 2) * 5, planterY - 23);
      ctx.stroke();
    }
  }

  if (booth.offer) drawProductStand(ctx, booth.offer, x, y, rect, theme, view.time);
  ctx.restore();
}

/** The seller's chosen person, standing outside the door with a chat bubble. */
function drawRep(ctx: CanvasRenderingContext2D, booth: RenderBooth, view: SceneView): void {
  const point = boothRepPoint(booth.slot);
  const theme = shopThemeFor(booth.slot, booth.color);
  const sx = point.x - view.cameraX;
  const groundY = point.y - view.cameraY;
  const tagY = drawPerson(ctx, {
    x: sx,
    groundY,
    scale: 1,
    dir: "down",
    moving: false,
    walkPhase: 0,
    time: view.time,
    gender: booth.avatarGender,
    color: booth.color,
    role: "seller",
    seed: booth.slot * 7919 + 13,
    name: booth.ownerName && booth.ownerName !== "—" ? booth.ownerName : booth.brand,
    isLocal: false,
  });

  // Chat bubble above the person.
  const label = booth.open ? "تحدث معي" : "اترك رسالة";
  ctx.save();
  ctx.font = `750 11px ${FONT}`;
  const bubbleW = ctx.measureText(label).width + 36;
  const bubbleH = 24;
  const bob = Math.sin(view.time / 420 + booth.slot) * 2;
  const bx = sx - bubbleW / 2;
  const by = tagY - bubbleH - 7 + bob;
  roundRect(ctx, bx, by, bubbleW, bubbleH, 12);
  ctx.fillStyle = "rgba(7,20,38,.96)";
  ctx.fill();
  ctx.strokeStyle = theme.trim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(7,20,38,.96)";
  ctx.beginPath();
  ctx.moveTo(sx - 5, by + bubbleH - 0.5);
  ctx.lineTo(sx + 5, by + bubbleH - 0.5);
  ctx.lineTo(sx, by + bubbleH + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = theme.trim;
  ctx.beginPath();
  ctx.moveTo(sx - 5, by + bubbleH);
  ctx.lineTo(sx, by + bubbleH + 6);
  ctx.lineTo(sx + 5, by + bubbleH);
  ctx.stroke();
  ctx.fillStyle = booth.open ? "#34d399" : "#64748b";
  ctx.beginPath();
  ctx.arc(bx + bubbleW - 13, by + bubbleH / 2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8f4f8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx + bubbleW / 2 - 4, by + bubbleH / 2 + 0.5);
  ctx.restore();
}

/* -------------------------------- people --------------------------------- */

type PersonSpec = {
  x: number;
  groundY: number;
  scale: number;
  dir: Direction;
  moving: boolean;
  walkPhase: number;
  time: number;
  gender: Gender;
  color: string;
  role: Role;
  seed: number;
  name: string;
  isLocal: boolean;
};

const SKIN_TONES = ["#f2c9a5", "#dca77c", "#b97d56", "#8d5c42", "#f0b98e"];
const HIJAB_COLORS = ["#f1ead9", "#334155", "#7a3b5e", "#1f6f5c", "#8a5a3b", "#d9b8c9", "#27408b", "#5b3f8c"];

/**
 * Draws one person and returns the y of the top of the name plate, so callers
 * can stack a chat bubble above it. Men get short hair; women wear a hijab
 * that covers the hair and neck and a long modest dress.
 */
function drawPerson(ctx: CanvasRenderingContext2D, spec: PersonSpec): number {
  const { x: sx, groundY, scale, dir, time, color, role, seed, gender, isLocal } = spec;
  const walk = spec.moving ? Math.sin(spec.walkPhase) : 0;
  const bob = spec.moving ? Math.abs(Math.sin(spec.walkPhase)) * 2.2 : Math.sin(time / 800 + sx * 0.01 + seed) * 0.45;
  const sy = groundY - 14 * scale - bob;
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const female = gender === "female";
  const faceShift = dir === "left" ? -2 : dir === "right" ? 2 : 0;

  ctx.save();
  ctx.fillStyle = "rgba(1,5,16,.45)";
  ctx.beginPath();
  ctx.ellipse(sx + 2, groundY + 4, 16 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isLocal) {
    ctx.strokeStyle = `rgba(45,212,191,${0.65 + Math.sin(time / 250) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, groundY + 2, 22 + Math.sin(time / 250) * 2, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.lineCap = "round";
  if (female) {
    // Long modest dress down to the ankles, swaying slightly while walking.
    const sway = walk * 2.5 * scale;
    const dress = ctx.createLinearGradient(sx, sy - 8, sx, groundY);
    dress.addColorStop(0, color);
    dress.addColorStop(1, "#1c2934");
    ctx.fillStyle = dress;
    ctx.beginPath();
    ctx.moveTo(sx - 9 * scale, sy - 6 * scale);
    ctx.quadraticCurveTo(sx - 12 * scale, sy + 8 * scale, sx - 14 * scale + sway, groundY - 1);
    ctx.lineTo(sx + 14 * scale + sway, groundY - 1);
    ctx.quadraticCurveTo(sx + 12 * scale, sy + 8 * scale, sx + 9 * scale, sy - 6 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#101820";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx + side * 5 * scale + sway, groundY - 0.5, 4 * scale, 2.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (role === "seller") {
      ctx.fillStyle = "rgba(239,231,210,.78)";
      roundRect(ctx, sx - 6 * scale, sy + 2 * scale, 12 * scale, 14 * scale, 3);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(230,215,180,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 7 * scale, sy - 5 * scale);
      ctx.lineTo(sx + 7 * scale, sy + 12 * scale);
      ctx.stroke();
    }
    // Long sleeves with small hands.
    for (const side of [-1, 1]) {
      const hx = sx + side * (11 - walk * 2) * scale;
      const hy = sy + 8 * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4.4 * scale;
      ctx.beginPath();
      ctx.moveTo(sx + side * 9 * scale, sy - 3 * scale);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(hx, hy + 1.5 * scale, 2.1 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hijab: covers the hair and neck and drapes over the shoulders.
    const scarf = HIJAB_COLORS[seed % HIJAB_COLORS.length];
    const hx = sx;
    const hy = sy - 17 * scale;
    ctx.fillStyle = scarf;
    ctx.beginPath();
    ctx.moveTo(hx - 10.8 * scale, hy);
    ctx.bezierCurveTo(hx - 11 * scale, hy - 13 * scale, hx + 11 * scale, hy - 13 * scale, hx + 10.8 * scale, hy);
    ctx.bezierCurveTo(hx + 12 * scale, hy + 8 * scale, hx + 13.5 * scale, hy + 14 * scale, hx + 11.5 * scale, hy + 19 * scale);
    ctx.quadraticCurveTo(hx, hy + 23 * scale, hx - 11.5 * scale, hy + 19 * scale);
    ctx.bezierCurveTo(hx - 13.5 * scale, hy + 14 * scale, hx - 12 * scale, hy + 8 * scale, hx - 10.8 * scale, hy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (dir !== "up") {
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(hx + faceShift * 0.6, hy + 0.8 * scale, 6.3 * scale, 7.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c252d";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(hx + faceShift + side * 2.5 * scale, hy + 0.5 * scale, 0.8 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = "rgba(0,0,0,.2)";
      ctx.beginPath();
      ctx.moveTo(hx, hy - 8 * scale);
      ctx.quadraticCurveTo(hx + 2 * scale, hy + 6 * scale, hx, hy + 17 * scale);
      ctx.stroke();
    }
  } else {
    // Walking legs and shoes.
    ctx.strokeStyle = "#17202b";
    ctx.lineWidth = 5 * scale;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx + side * 4 * scale, sy + 10 * scale);
      ctx.lineTo(sx + side * (4 + walk * 4) * scale, groundY - 1);
      ctx.stroke();
    }

    // Torso, seller apron or visitor shoulder bag.
    const torso = ctx.createLinearGradient(sx, sy - 8, sx, sy + 13);
    torso.addColorStop(0, color);
    torso.addColorStop(1, "#1c2934");
    roundRect(ctx, sx - 10 * scale, sy - 9 * scale, 20 * scale, 24 * scale, 8 * scale);
    ctx.fillStyle = torso;
    ctx.fill();
    if (role === "seller") {
      ctx.fillStyle = "rgba(239,231,210,.75)";
      roundRect(ctx, sx - 6 * scale, sy + 1, 12 * scale, 13 * scale, 3);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(230,215,180,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 7 * scale, sy - 7 * scale);
      ctx.lineTo(sx + 7 * scale, sy + 12 * scale);
      ctx.stroke();
    }

    // Arms swing naturally while walking.
    ctx.strokeStyle = skin;
    ctx.lineWidth = 4 * scale;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx + side * 9 * scale, sy - 3 * scale);
      ctx.lineTo(sx + side * (11 - walk * 2) * scale, sy + 8 * scale);
      ctx.stroke();
    }

    // Head and short hair, with the face following movement direction.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(sx, sy - 17 * scale, 8.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = seed % 3 === 0 ? "#33261f" : "#151b24";
    ctx.beginPath();
    ctx.arc(sx, sy - 19 * scale, 8.4 * scale, Math.PI, Math.PI * 2);
    ctx.fill();
    if (dir !== "up") {
      ctx.fillStyle = "#1c252d";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx + faceShift + side * 2.8 * scale, sy - 16 * scale, 0.8 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Crisp name plate.
  ctx.font = `650 11px ${FONT}`;
  const label = isLocal ? `${spec.name} · أنت` : spec.name;
  const width = ctx.measureText(label).width + 18;
  const tagY = sy - 46 * scale;
  roundRect(ctx, sx - width / 2, tagY, width, 19, 7);
  ctx.fillStyle = isLocal ? "rgba(8,25,29,.96)" : "rgba(6,14,30,.88)";
  ctx.fill();
  ctx.strokeStyle = isLocal ? "#2dd4bf" : "rgba(148,175,200,.32)";
  ctx.lineWidth = isLocal ? 1.5 : 1;
  ctx.stroke();
  ctx.fillStyle = "#edf5f4";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, sx, tagY + 10);
  ctx.restore();
  return tagY;
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: RenderPlayer, view: SceneView, isLocal: boolean): void {
  drawPerson(ctx, {
    x: player.x - view.cameraX,
    groundY: player.y - view.cameraY,
    scale: Math.max(0.4, easeOutBack(player.joinProgress)),
    dir: player.dir,
    moving: player.moving,
    walkPhase: player.walkPhase,
    time: view.time,
    gender: player.gender,
    color: player.color,
    role: player.role,
    seed: hashText(player.id),
    name: player.name,
    isLocal,
  });
}

/* -------------------------- navigation & minimap -------------------------- */

function drawTargetBeacon(ctx: CanvasRenderingContext2D, view: SceneView, slot: number): void {
  const target = boothStandingPoint(slot);
  const x = target.x - view.cameraX;
  const y = target.y - view.cameraY;
  if (x > 30 && x < view.width - 30 && y > 30 && y < view.height - 30) {
    const beam = ctx.createLinearGradient(x, y - 100, x, y);
    beam.addColorStop(0, "rgba(250,204,21,0)");
    beam.addColorStop(1, "rgba(250,204,21,.22)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    ctx.lineTo(x - 4, y - 100);
    ctx.lineTo(x + 4, y - 100);
    ctx.lineTo(x + 20, y);
    ctx.closePath();
    ctx.fill();
    return;
  }

  const cx = view.width / 2;
  const cy = view.height / 2;
  const angle = Math.atan2(y - cy, x - cx);
  const radius = Math.min(view.width, view.height) / 2 - 55;
  const ax = cx + Math.cos(angle) * radius;
  const ay = cy + Math.sin(angle) * radius;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = "#facc15";
  ctx.shadowColor = "rgba(250,204,21,.55)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(-9, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  view: SceneView,
  booths: Map<number, RenderBooth>,
  local: RenderPlayer,
  targetSlot: number | null,
): void {
  const width = 142;
  const height = width * (WORLD_HEIGHT / WORLD_WIDTH);
  const x0 = view.width - width - 12;
  // Keep the map above the mobile action dock instead of underneath it.
  const y0 = view.height - height - (view.width < 640 ? 92 : 12);
  const sx = width / WORLD_WIDTH;
  const sy = height / WORLD_HEIGHT;
  ctx.save();
  roundRect(ctx, x0, y0, width, height, 10);
  ctx.fillStyle = "rgba(4,12,30,.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(181,204,211,.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(148,163,184,.16)";
  for (let slot = 1; slot <= BOOTH_COLS * BOOTH_ROWS; slot += 1) {
    if (booths.has(slot)) continue;
    const rect = boothRect(slot);
    ctx.fillRect(x0 + rect.x * sx, y0 + rect.y * sy, Math.max(2.5, rect.w * sx), Math.max(2.5, rect.h * sy));
  }
  for (const booth of booths.values()) {
    const rect = boothRect(booth.slot);
    ctx.fillStyle = booth.open ? booth.color : "rgba(148,163,184,.3)";
    ctx.fillRect(x0 + rect.x * sx, y0 + rect.y * sy, Math.max(2.5, rect.w * sx), Math.max(2.5, rect.h * sy));
  }
  ctx.strokeStyle = "rgba(230,240,245,.48)";
  ctx.strokeRect(x0 + view.cameraX * sx, y0 + view.cameraY * sy, view.width * sx, view.height * sy);
  if (targetSlot !== null) {
    const rect = boothRect(targetSlot);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(x0 + (rect.x + rect.w / 2) * sx, y0 + (rect.y + rect.h / 2) * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#2dd4bf";
  ctx.beginPath();
  ctx.arc(x0 + local.x * sx, y0 + local.y * sy, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMarket(
  ctx: CanvasRenderingContext2D,
  view: SceneView,
  booths: Map<number, RenderBooth>,
  players: RenderPlayer[],
  options: SceneOptions,
): void {
  drawFloor(ctx, view, options.highDetail);

  const colStart = Math.max(0, Math.floor((view.cameraX - ORIGIN_X - 90) / PITCH_X));
  const colEnd = Math.min(BOOTH_COLS - 1, Math.ceil((view.cameraX + view.width - ORIGIN_X + 90) / PITCH_X));
  const rowStart = Math.max(0, Math.floor((view.cameraY - ORIGIN_Y - 130) / PITCH_Y));
  const rowEnd = Math.min(BOOTH_ROWS - 1, Math.ceil((view.cameraY + view.height - ORIGIN_Y + 80) / PITCH_Y));

  const reps: RenderBooth[] = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      const slot = row * BOOTH_COLS + col + 1;
      const booth = booths.get(slot);
      if (booth) {
        drawBooth(ctx, booth, view, options);
        reps.push(booth);
      } else {
        drawBooth(ctx, vacantBooth(slot), view, options);
      }
    }
  }
  // Representatives stand on the pavement, so they are drawn after every
  // building (the next row's sign must never hide their feet).
  for (const booth of reps) drawRep(ctx, booth, view);

  const visiblePlayers = players
    .filter((player) => {
      const x = player.x - view.cameraX;
      const y = player.y - view.cameraY;
      return x > -80 && x < view.width + 80 && y > -100 && y < view.height + 80;
    })
    .sort((a, b) => a.y - b.y);
  for (const player of visiblePlayers) drawPlayer(ctx, player, view, player.id === options.localId);

  if (options.targetSlot !== null) drawTargetBeacon(ctx, view, options.targetSlot);
  const local = players.find((player) => player.id === options.localId);
  if (local) drawMinimap(ctx, view, booths, local, options.targetSlot);

  const vignette = ctx.createRadialGradient(
    view.width / 2, view.height / 2, Math.min(view.width, view.height) * 0.48,
    view.width / 2, view.height / 2, Math.max(view.width, view.height) * 0.82,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, view.width, view.height);
}

export function drawJoystick(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  knobX: number,
  knobY: number,
  maxRadius: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(8,18,25,.42)";
  ctx.beginPath();
  ctx.arc(originX, originY, maxRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(94,234,212,.38)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const knob = ctx.createRadialGradient(knobX - 6, knobY - 8, 2, knobX, knobY, 25);
  knob.addColorStop(0, "rgba(230,255,250,.95)");
  knob.addColorStop(1, "rgba(20,184,166,.72)");
  ctx.fillStyle = knob;
  ctx.shadowColor = "rgba(45,212,191,.55)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(knobX, knobY, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
