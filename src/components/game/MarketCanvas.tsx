"use client";

import { useEffect, useRef, useState } from "react";

import ChatPanel from "@/components/game/ChatPanel";
import OffersExplorer from "@/components/game/OffersExplorer";
import { FarshaMark, Icon } from "@/components/ui/Icon";
import {
  BOOTH_COUNT,
  HIDDEN_SYNC_INTERVAL_MS,
  MOVE_SPEED_SELLER,
  MOVE_SPEED_VISITOR,
  SYNC_INTERVAL_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  boothRepPoint,
  clampToWorld,
  isBlocked,
  repSlotAtPoint,
  slotAtPoint,
  standSlotAtPoint,
} from "@/lib/game/constants";
import { apiChat } from "@/lib/game/client";
import { drawJoystick, drawMarket, type RenderBooth, type RenderPlayer } from "@/lib/game/renderer";
import type {
  BoothSummary,
  Direction,
  FeedItem,
  MarketStats,
  PlayerDto,
  SessionPayload,
  StateResponse,
} from "@/lib/game/types";

type Remote = RenderPlayer & { tx: number; ty: number };
type Toast = { id: number; at: number; text: string; tone: "join" };
type Hud = {
  stats: MarketStats;
  ping: number;
  status: "online" | "reconnecting";
  x: number;
  y: number;
  booths: BoothSummary[];
  feed: FeedItem[];
  toasts: Toast[];
};

const MAX_JOY_RADIUS = 60;
const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
const EMPTY_STATS: MarketStats = { online: 1, visitors: 1, sellers: 0, takenBooths: 0, openBooths: 0 };

export type MarketCanvasProps = {
  session: SessionPayload;
  startX: number;
  startY: number;
  targetSlot: number | null;
  onTargetChange: (slot: number | null) => void;
  onOpenBooth: (slot: number) => void;
  onOpenPanel: () => void;
  onRentSlot: (slot: number) => void;
  onExpire: () => void;
};

export default function MarketCanvas(props: MarketCanvasProps) {
  const { session, startX, startY, targetSlot, onTargetChange, onOpenBooth, onOpenPanel, onRentSlot, onExpire } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const localRef = useRef({
    ...session, x: startX, y: startY, dir: "down" as Direction,
    moving: false, walkPhase: 0, joinProgress: 0,
  });
  const remotesRef = useRef(new Map<string, Remote>());
  const boothsRef = useRef(new Map<number, RenderBooth>());
  const summariesRef = useRef<BoothSummary[]>([]);
  const keysRef = useRef(new Set<Direction>());
  const joyRef = useRef({ active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 });
  const tapRef = useRef({ x: 0, y: 0, at: 0, moved: 0, active: false, pointerId: -1 });
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const netRef = useRef({ ping: 0, status: "online" as "online" | "reconnecting", inflight: false, failures: 0 });
  const toastsRef = useRef<Toast[]>([]);
  const toastIdRef = useRef(0);
  const targetRef = useRef<number | null>(targetSlot);
  const cameraRef = useRef({ x: 0, y: 0, ready: false });
  const stateRef = useRef({ stats: null as MarketStats | null, feed: [] as FeedItem[] });
  const qualityRef = useRef({ highDetail: true, samples: 0, total: 0 });
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [chatSlot, setChatSlot] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const chatSlotRef = useRef<number | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const openBoothRef = useRef(onOpenBooth);
  const rentRef = useRef(onRentSlot);
  useEffect(() => { openBoothRef.current = onOpenBooth; rentRef.current = onRentSlot; });
  const [hud, setHud] = useState<Hud>({
    stats: EMPTY_STATS, ping: 0, status: "online", x: Math.round(startX), y: Math.round(startY),
    booths: [], feed: [], toasts: [],
  });

  useEffect(() => { targetRef.current = targetSlot; }, [targetSlot]);
  useEffect(() => { chatSlotRef.current = chatSlot; }, [chatSlot]);
  useEffect(() => {
    localRef.current.role = session.role;
    localRef.current.boothSlot = session.boothSlot;
    localRef.current.gender = session.gender;
  }, [session.role, session.boothSlot, session.gender]);

  // Sellers see a badge for visitor messages they have not read yet.
  useEffect(() => {
    if (session.role !== "seller" || session.boothSlot === null) { setUnread(0); return; }
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      const result = await apiChat("unread", session);
      if (!cancelled && typeof result.unread === "number") setUnread(result.unread);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.role, session.boothSlot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let stopped = false;
    let firstPayload = true;
    qualityRef.current.highDetail = (navigator.hardwareConcurrency ?? 4) >= 4;

    const applySize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, qualityRef.current.highDetail ? 2 : 1.25);
      sizeRef.current = { w: Math.max(1, rect.width), h: Math.max(1, rect.height), dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(wrap);

    const pushToast = (text: string, tone: Toast["tone"]) => {
      toastIdRef.current += 1;
      toastsRef.current = [...toastsRef.current.slice(-2), { id: toastIdRef.current, at: Date.now(), text, tone }];
    };

    const isTyping = (target: EventTarget | null) => target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    const onKeyDown = (event: KeyboardEvent) => {
      const dir = KEY_MAP[event.code];
      if (!dir || isTyping(event.target)) return;
      event.preventDefault();
      keysRef.current.add(dir);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const dir = KEY_MAP[event.code];
      if (dir) keysRef.current.delete(dir);
    };
    const clearKeys = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);

    const localPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerDown = (event: PointerEvent) => {
      const point = localPoint(event);
      tapRef.current = { x: point.x, y: point.y, at: performance.now(), moved: 0, active: true, pointerId: event.pointerId };
      if (joyRef.current.active) return;
      joyRef.current = { active: true, originX: point.x, originY: point.y, dx: 0, dy: 0, pointerId: event.pointerId };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* no-op */ }
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent) => {
      const tap = tapRef.current;
      if (tap.active && tap.pointerId === event.pointerId) {
        const point = localPoint(event);
        tap.moved = Math.max(tap.moved, Math.hypot(point.x - tap.x, point.y - tap.y));
      }
      const joy = joyRef.current;
      if (!joy.active || joy.pointerId !== event.pointerId) return;
      const point = localPoint(event);
      let dx = point.x - joy.originX;
      let dy = point.y - joy.originY;
      const length = Math.hypot(dx, dy);
      if (length > MAX_JOY_RADIUS) { dx = dx / length * MAX_JOY_RADIUS; dy = dy / length * MAX_JOY_RADIUS; }
      joy.dx = dx;
      joy.dy = dy;
    };
    const endPointer = (event: PointerEvent) => {
      const joy = joyRef.current;
      const tap = tapRef.current;
      if (tap.active && tap.pointerId === event.pointerId) {
        tap.active = false;
        if (performance.now() - tap.at < 450 && tap.moved < 14) {
          const camera = cameraRef.current;
          const wx = tap.x + camera.x;
          const wy = tap.y + camera.y;
          const repSlot = repSlotAtPoint(wx, wy);
          const standSlot = standSlotAtPoint(wx, wy);
          if (repSlot !== null && boothsRef.current.has(repSlot)) {
            // The shop's representative: opens the chat box above the person.
            setChatSlot(repSlot);
          } else if (standSlot !== null && boothsRef.current.get(standSlot)?.offer) {
            // The product stand beside the shop: "المزيد".
            openBoothRef.current(standSlot);
          } else {
            const slot = slotAtPoint(wx, wy);
            if (slot !== null) {
              if (boothsRef.current.has(slot)) openBoothRef.current(slot);
              else rentRef.current(slot);
            }
          }
        }
      }
      if (joy.active && joy.pointerId === event.pointerId) {
        joyRef.current = { active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 };
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      }
    };
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    const preventMenu = (event: Event) => event.preventDefault();
    canvas.addEventListener("contextmenu", preventMenu);

    const update = (dt: number) => {
      const local = localRef.current;
      let ax = 0;
      let ay = 0;
      if (keysRef.current.has("left")) ax -= 1;
      if (keysRef.current.has("right")) ax += 1;
      if (keysRef.current.has("up")) ay -= 1;
      if (keysRef.current.has("down")) ay += 1;
      const joy = joyRef.current;
      if (joy.active) {
        const jx = joy.dx / MAX_JOY_RADIUS;
        const jy = joy.dy / MAX_JOY_RADIUS;
        if (Math.hypot(jx, jy) > 0.14) { ax += jx; ay += jy; }
      }
      let magnitude = Math.hypot(ax, ay);
      if (magnitude > 1) { ax /= magnitude; ay /= magnitude; magnitude = 1; }
      local.moving = magnitude > 0.08;
      if (local.moving) {
        const speed = local.role === "seller" ? MOVE_SPEED_SELLER : MOVE_SPEED_VISITOR;
        const nextX = clampToWorld(local.x + ax * speed * dt, "x");
        if (!isBlocked(nextX, local.y)) local.x = nextX;
        const nextY = clampToWorld(local.y + ay * speed * dt, "y");
        if (!isBlocked(local.x, nextY)) local.y = nextY;
        local.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? "left" : "right") : ay < 0 ? "up" : "down";
        local.walkPhase += dt * (8 + 9 * magnitude);
      }
      local.joinProgress = Math.min(1, local.joinProgress + dt * 2.8);
      const smoothing = 1 - Math.exp(-dt * 14);
      for (const remote of remotesRef.current.values()) {
        if (Math.hypot(remote.tx - remote.x, remote.ty - remote.y) > 300) {
          remote.x = remote.tx; remote.y = remote.ty;
        } else {
          remote.x += (remote.tx - remote.x) * smoothing;
          remote.y += (remote.ty - remote.y) * smoothing;
        }
        remote.joinProgress = Math.min(1, remote.joinProgress + dt * 2.8);
        if (remote.moving) remote.walkPhase += dt * 12;
      }
    };

    const render = (now: number) => {
      const { w, h, dpr } = sizeRef.current;
      const local = localRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let desiredX = local.x - w / 2;
      let desiredY = local.y - h / 2;
      desiredX = w >= WORLD_WIDTH ? (WORLD_WIDTH - w) / 2 : Math.min(Math.max(desiredX, 0), WORLD_WIDTH - w);
      desiredY = h >= WORLD_HEIGHT ? (WORLD_HEIGHT - h) / 2 : Math.min(Math.max(desiredY, 0), WORLD_HEIGHT - h);
      const camera = cameraRef.current;
      if (!camera.ready) { camera.x = desiredX; camera.y = desiredY; camera.ready = true; }
      camera.x += (desiredX - camera.x) * 0.16;
      camera.y += (desiredY - camera.y) * 0.16;

      const players: RenderPlayer[] = [{
        id: local.id, name: local.name, color: local.color, role: local.role, device: local.device,
        x: local.x, y: local.y, dir: local.dir, moving: local.moving, walkPhase: local.walkPhase,
        joinProgress: local.joinProgress, boothSlot: local.boothSlot, gender: local.gender,
      }, ...remotesRef.current.values()];
      drawMarket(ctx, { width: w, height: h, cameraX: camera.x, cameraY: camera.y, time: now }, boothsRef.current, players, {
        localId: local.id, targetSlot: targetRef.current, selectedSlot: targetRef.current,
        highDetail: qualityRef.current.highDetail,
      });
      if (joyRef.current.active) { const joystick = joyRef.current; drawJoystick(ctx, joystick.originX, joystick.originY, joystick.originX + joystick.dx, joystick.originY + joystick.dy, MAX_JOY_RADIUS); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // The chat box floats above the representative it belongs to.
      const box = chatBoxRef.current;
      const openSlot = chatSlotRef.current;
      if (box && openSlot !== null) {
        const rep = boothRepPoint(openSlot);
        const px = rep.x - camera.x;
        const py = rep.y - camera.y;
        const boxW = Math.min(320, w - 16);
        const boxH = box.offsetHeight;
        const topY = py - 104 - boxH;
        const anchored = w >= 640 && px > 20 && px < w - 20 && topY > 62 && py < h;
        box.style.width = `${boxW}px`;
        if (anchored) {
          box.style.left = `${Math.min(Math.max(px - boxW / 2, 8), w - boxW - 8)}px`;
          box.style.top = `${topY}px`;
          box.style.bottom = "auto";
        } else {
          box.style.left = `${(w - boxW) / 2}px`;
          box.style.top = "auto";
          box.style.bottom = "84px";
        }
        box.style.visibility = "visible";
      }
    };

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      if (stopped) return;
      const rawDt = Math.max(0, (now - last) / 1000);
      const dt = Math.min(0.05, rawDt);
      last = now;
      update(dt);
      render(now);

      // Adaptive quality: sustained slow frames reduce DPR and decorative work,
      // while movement/networking continue at full fidelity.
      const quality = qualityRef.current;
      quality.samples += 1;
      quality.total += rawDt;
      if (quality.samples >= 100) {
        if (quality.highDetail && quality.total / quality.samples > 0.029) {
          quality.highDetail = false;
          applySize();
        }
        quality.samples = 0;
        quality.total = 0;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const applyBooths = (incoming: BoothSummary[]) => {
      summariesRef.current = incoming;
      const map = boothsRef.current;
      const seen = new Set<number>();
      for (const summary of incoming) {
        seen.add(summary.slot);
        const existing = map.get(summary.slot);
        const next: RenderBooth = {
          slot: summary.slot, brand: summary.brand, color: summary.color, category: summary.category,
          logoUrl: summary.logoUrl, open: summary.open, liveMessage: summary.liveMessage,
          productsCount: summary.productsCount, ownerName: summary.ownerName,
          avatarGender: summary.avatarGender, offer: summary.offer,
        };
        if (existing) {
          Object.assign(existing, next);
        } else {
          map.set(summary.slot, next);
          if (!firstPayload) pushToast(`افتتح ${summary.brand} محله رقم ${summary.slot}`, "join");
        }
      }
      for (const slot of map.keys()) if (!seen.has(slot)) map.delete(slot);
    };

    const applyPlayers = (incoming: PlayerDto[]) => {
      const map = remotesRef.current;
      const seen = new Set<string>();
      for (const dto of incoming) {
        seen.add(dto.id);
        const existing = map.get(dto.id);
        if (existing) {
          Object.assign(existing, {
            tx: dto.x, ty: dto.y, dir: dto.dir, moving: dto.moving, name: dto.name,
            color: dto.color, device: dto.device, role: dto.role, boothSlot: dto.boothSlot, gender: dto.gender,
          });
        } else {
          map.set(dto.id, {
            ...dto, x: dto.x, y: dto.y, tx: dto.x, ty: dto.y, walkPhase: 0, joinProgress: 0,
          });
          if (!firstPayload && map.size < 60) pushToast(`${dto.name} يتجوّل الآن بالقرب منك`, "join");
        }
      }
      // Leaving the nearby streaming radius is not a disconnect; just unload.
      for (const id of map.keys()) if (!seen.has(id)) map.delete(id);
    };

    let syncTimer = 0;
    const sync = async () => {
      if (stopped) return;
      const net = netRef.current;
      if (net.inflight) { syncTimer = window.setTimeout(() => void sync(), 200); return; }
      net.inflight = true;
      const me = localRef.current;
      const started = performance.now();
      let nextDelay = document.hidden ? HIDDEN_SYNC_INTERVAL_MS : SYNC_INTERVAL_MS;
      try {
        const response = await fetch("/api/state", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: me.id, secret: me.secret, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10,
            dir: me.dir, moving: me.moving,
          }),
        });
        if (!response.ok) throw new Error("network");
        const data = (await response.json()) as StateResponse;
        net.ping = performance.now() - started;
        net.failures = 0;
        net.status = "online";
        if (data.expired) { onExpire(); return; }
        applyPlayers(data.players ?? []);
        applyBooths(data.booths ?? []);
        stateRef.current = { stats: data.stats, feed: data.feed ?? [] };
        firstPayload = false;
      } catch {
        net.failures += 1;
        net.status = net.failures > 1 ? "reconnecting" : "online";
        nextDelay = Math.min(2400, 350 * Math.pow(1.7, net.failures));
      } finally {
        net.inflight = false;
        if (!stopped) syncTimer = window.setTimeout(() => void sync(), nextDelay);
      }
    };
    const onVisibility = () => { if (!document.hidden) { window.clearTimeout(syncTimer); void sync(); } };
    document.addEventListener("visibilitychange", onVisibility);
    void sync();

    const hudTimer = window.setInterval(() => {
      if (document.hidden) return;
      const me = localRef.current;
      toastsRef.current = toastsRef.current.filter((toast) => Date.now() - toast.at < 4300);
      setHud({
        stats: stateRef.current.stats ?? { ...EMPTY_STATS, takenBooths: boothsRef.current.size },
        ping: Math.round(netRef.current.ping), status: netRef.current.status,
        x: Math.round(me.x), y: Math.round(me.y), booths: summariesRef.current,
        feed: stateRef.current.feed, toasts: [...toastsRef.current],
      });
    }, 350);

    const leaveWorld = () => {
      const me = localRef.current;
      const payload = JSON.stringify({ id: me.id, secret: me.secret });
      try {
        if (navigator.sendBeacon) navigator.sendBeacon("/api/leave", new Blob([payload], { type: "text/plain;charset=UTF-8" }));
      } catch { /* best effort */ }
    };
    window.addEventListener("pagehide", leaveWorld);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(syncTimer);
      window.clearInterval(hudTimer);
      window.removeEventListener("pagehide", leaveWorld);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("contextmenu", preventMenu);
      observer.disconnect();
    };
    // One world loop per joined session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#080d14]">
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#071019]/85 px-3 py-2 shadow-xl backdrop-blur-xl">
          <FarshaMark size={31} className="text-teal-100" />
          <div className="hidden sm:block">
            <p className="text-xs font-black text-white">فرشة <span className="font-medium text-teal-300">Farsha</span></p>
            <p className="text-[8px] tracking-[.18em] text-slate-500">LIVE STREET MARKET</p>
          </div>
          <span className="h-7 w-px bg-white/10" />
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Icon name="users" size={13} className="text-teal-300" /><b className="font-mono text-white">{hud.stats.online}</b></span>
            <span className="flex items-center gap-1"><Icon name="shop" size={13} className="text-amber-300" /><b className="font-mono text-white">{hud.stats.takenBooths}</b><span>/{BOOTH_COUNT}</span></span>
          </div>
          <span className={`h-1.5 w-1.5 rounded-full ${hud.status === "online" ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`} />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {session.role === "seller" && session.boothSlot !== null ? (
            <button type="button" onClick={() => setChatSlot(session.boothSlot)} className="relative flex h-11 items-center gap-2 rounded-2xl border border-teal-300/25 bg-[#071a24]/90 px-3 text-[11px] font-bold text-teal-100 shadow-xl backdrop-blur-xl transition hover:bg-teal-300/15">
              <Icon name="chat" size={18} />
              <span className="hidden sm:inline">رسائل الزوار</span>
              {unread > 0 ? <span className="absolute -left-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{unread}</span> : null}
            </button>
          ) : null}
          {session.role === "seller" ? (
            <button type="button" onClick={onOpenPanel} className="flex h-11 items-center gap-2 rounded-2xl border border-amber-300/25 bg-[#211a10]/90 px-3 text-[11px] font-bold text-amber-100 shadow-xl backdrop-blur-xl transition hover:bg-amber-300/15">
              <Icon name="seller" size={18} />
              <span className="hidden sm:inline">إدارة محلي {session.boothSlot ? `#${session.boothSlot}` : ""}</span>
            </button>
          ) : null}
          <div className="hidden rounded-2xl border border-white/10 bg-[#071019]/80 px-3 py-2 text-[9px] text-slate-500 backdrop-blur sm:block">
            <span className="font-mono text-slate-300">{hud.x}, {hud.y}</span><br />{hud.ping}ms
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {hud.toasts.slice(-2).map((toast) => (
          <div key={toast.id} className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-[10px] font-semibold shadow-lg backdrop-blur-xl ${"border-teal-300/25 bg-teal-950/85 text-teal-100"}`}>{toast.text}</div>
        ))}
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[22px] border border-white/10 bg-[#071019]/88 p-1.5 shadow-[0_16px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
        <button type="button" onClick={() => setExplorerOpen(true)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-teal-300 to-emerald-400 px-4 py-2.5 text-xs font-black text-[#06201e] transition hover:brightness-110 sm:px-5">
          <Icon name="offers" size={18} />استكشف العروض
        </button>
        {targetSlot !== null ? (
          <button type="button" onClick={() => onTargetChange(null)} className="flex items-center gap-1.5 rounded-2xl bg-white/5 px-3 py-2.5 text-[10px] font-bold text-amber-200 transition hover:bg-white/10">
            <Icon name="navigation" size={15} /><span className="hidden sm:inline">إلغاء الوجهة</span> #{targetSlot}<Icon name="close" size={12} />
          </button>
        ) : (
          <div className="hidden items-center gap-2 px-3 text-[10px] text-slate-500 md:flex"><Icon name="walk" size={16} />WASD أو اسحب للتحرّك</div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-[220px] text-[9px] leading-relaxed text-slate-500 lg:block">
        اضغط على واجهة أي محل لفتح عروضه، أو على الشخص أمامه للمحادثة · المحلات المكتوب عليها «متاح للإيجار» يمكن استئجارها
      </div>

      {chatSlot !== null ? (() => {
        const summary = hud.booths.find((item) => item.slot === chatSlot);
        if (!summary) return null;
        return (
          <div ref={chatBoxRef} className="absolute z-30" style={{ visibility: "hidden", left: 0, top: 0 }}>
            <ChatPanel
              key={chatSlot}
              mode={chatSlot === session.boothSlot ? "seller" : "visitor"}
              session={session}
              slot={chatSlot}
              brand={summary.brand}
              online={summary.open}
              gender={summary.avatarGender}
              onClose={() => { setChatSlot(null); if (chatSlot === session.boothSlot) setUnread(0); }}
            />
          </div>
        );
      })() : null}

      {explorerOpen ? (
        <OffersExplorer
          booths={hud.booths}
          position={{ x: hud.x, y: hud.y }}
          onOpen={(slot) => { setExplorerOpen(false); onOpenBooth(slot); }}
          onNavigate={(slot) => { onTargetChange(slot); setExplorerOpen(false); }}
          onClose={() => setExplorerOpen(false)}
        />
      ) : null}
    </div>
  );
}
