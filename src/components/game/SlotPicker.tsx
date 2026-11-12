"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  BOOTH_COLS,
  BOOTH_COUNT,
  ZONE_NAMES,
  ZONE_NAMES_AR,
  ZONE_ROWS,
  ZONE_TINTS,
  boothGrid,
  boothSlot,
  zoneLabel,
} from "@/lib/game/constants";
import { apiMarket } from "@/lib/game/client";
import type { BoothSummary } from "@/lib/game/types";

export default function SlotPicker({ selected, onSelect, onAuto }: {
  selected: number | null;
  onSelect: (slot: number) => void;
  onAuto: () => void;
}) {
  const [booths, setBooths] = useState<Map<number, BoothSummary>>(new Map());
  const [zone, setZone] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiMarket();
        if (!cancelled) setBooths(new Map(data.booths.map((booth) => [booth.slot, booth])));
      } catch { /* keep previous state */ }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const slots = useMemo(() => {
    const output: number[] = [];
    for (let row = zone * ZONE_ROWS; row < (zone + 1) * ZONE_ROWS; row += 1) {
      for (let col = 0; col < BOOTH_COLS; col += 1) output.push(boothSlot(col, row));
    }
    return output;
  }, [zone]);

  const selectedBooth = selected !== null ? booths.get(selected) : undefined;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-300/10 text-teal-300"><Icon name="map" /></span>
          <div><h3 className="text-sm font-extrabold text-white">اختر موقعك على الشارع</h3><p className="mt-0.5 text-[10px] text-slate-500">{loading ? "جاري قراءة خريطة السوق…" : `${booths.size}/${BOOTH_COUNT} محل محجوز · كل رواق يضم 20 محلًا`}</p></div>
        </div>
        <button type="button" onClick={onAuto} className="flex items-center gap-1.5 rounded-xl border border-teal-300/25 bg-teal-300/10 px-3 py-2 text-[10px] font-bold text-teal-200 transition hover:bg-teal-300/20"><Icon name="spark" size={14} />اختر لي تلقائيًا</button>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5 rounded-2xl bg-black/20 p-1.5">
        {ZONE_NAMES.map((name, index) => (
          <button key={name} type="button" onClick={() => setZone(index)} className={`rounded-xl px-1 py-2 text-center transition ${zone === index ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-300"}`} style={zone === index ? { boxShadow: `inset 0 -2px 0 ${ZONE_TINTS[index]}` } : undefined}>
            <span className="block text-xs font-black">{name}</span><span className="mt-0.5 block truncate text-[8px]">{ZONE_NAMES_AR[index]}</span>
          </button>
        ))}
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/[.06] bg-[#101820] p-3">
        <div className="absolute left-1/2 top-1/2 h-3 w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/[.05]" />
        <div className="relative grid grid-cols-10 gap-1.5 sm:gap-2">
          {slots.map((slot) => {
            const booth = booths.get(slot);
            const isSelected = selected === slot;
            return (
              <button key={slot} type="button" disabled={booth !== undefined} onClick={() => onSelect(slot)} title={booth ? `${booth.brand} · محجوز` : `المحل ${slot} متاح`} className={`group relative aspect-[1.15] rounded-md border text-[9px] font-bold transition ${booth ? "cursor-not-allowed border-white/[.04] bg-slate-800/80 text-slate-700" : isSelected ? "z-10 scale-110 border-amber-200 bg-amber-300 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,.35)]" : "border-teal-200/15 bg-teal-200/[.07] text-teal-100/50 hover:z-10 hover:scale-105 hover:border-teal-200/50 hover:text-white"}`}>
                {booth ? <Icon name="shop" size={13} className="mx-auto" /> : slot}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[8px] text-slate-600"><span className="h-px w-10 bg-white/10" />ممر المشاة<span className="h-px w-10 bg-white/10" /></div>
      </div>

      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-2.5 text-[10px] leading-relaxed text-slate-400">
        <Icon name={selectedBooth ? "close" : "check"} size={14} className={selectedBooth ? "text-rose-300" : "text-teal-300"} />
        {selected === null ? "اختر أي محل فاتح، أو دع النظام يحجز لك أول موقع متاح." : selectedBooth ? `المحل ${selected} محجوز الآن بواسطة ${selectedBooth.brand}. اختر موقعًا آخر.` : `المحل ${selected} متاح · رواق ${zoneLabel(selected)} · الصف ${boothGrid(selected).row + 1}`}
      </p>
    </section>
  );
}
