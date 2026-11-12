"use client";

import { useMemo, useState } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { CATEGORIES, boothCenter, categoryLabel } from "@/lib/game/constants";
import type { BoothSummary } from "@/lib/game/types";

type Tab = "nearby" | "all";

export default function OffersExplorer({
  booths,
  position,
  onOpen,
  onNavigate,
  onClose,
}: {
  booths: BoothSummary[];
  position: { x: number; y: number };
  onOpen: (slot: number) => void;
  onNavigate: (slot: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("nearby");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return booths
      .map((booth) => {
        const center = boothCenter(booth.slot);
        return {
          booth,
          distance: Math.round(Math.hypot(center.x - position.x, center.y - position.y)),
        };
      })
      .filter(({ booth }) => {
        if (openOnly && !booth.open) return false;
        if (category !== "all" && booth.category !== category) return false;
        if (!normalized) return true;
        return (
          booth.brand.toLowerCase().includes(normalized) ||
          booth.tagline.toLowerCase().includes(normalized) ||
          booth.offer?.name.toLowerCase().includes(normalized) ||
          String(booth.slot).includes(normalized)
        );
      })
      .sort((a, b) => {
        if (tab === "all") return Number(b.booth.open) - Number(a.booth.open) || a.booth.slot - b.booth.slot;
        return a.distance - b.distance;
      });
  }, [booths, category, openOnly, position, query, tab]);

  const tabs: { key: Tab; label: string; icon: IconName }[] = [
    { key: "nearby", label: "الأقرب إليك", icon: "compass" },
    { key: "all", label: "كل المحلات", icon: "grid" },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#03070c]/80 p-0 backdrop-blur-md sm:items-center sm:p-6">
      <section className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0a111a]/95 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:h-[82vh] sm:rounded-[28px]">
        <header className="border-b border-white/10 bg-[linear-gradient(110deg,rgba(45,212,191,.08),transparent_45%,rgba(245,158,11,.06))] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-black text-white">دليل السوق والعروض</p>
              <p className="mt-1 text-[11px] text-slate-400">تصفّح كل ما يُعرض الآن دون أن تمشي بين كل المحلات</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="إغلاق">
              <Icon name="close" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Icon name="search" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث باسم المحل أو المنتج أو رقم المحل…"
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/25 pr-10 pl-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-teal-400/50"
              />
            </div>
            <div className="flex rounded-2xl border border-white/10 bg-black/20 p-1">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition lg:flex-none ${tab === item.key ? "bg-teal-400/15 text-teal-200" : "text-slate-500 hover:text-slate-200"}`}
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")} label="كل الأقسام" />
            {CATEGORIES.map((item) => (
              <FilterChip key={item.key} active={category === item.key} onClick={() => setCategory(item.key)} label={item.label} />
            ))}
            <button type="button" onClick={() => setOpenOnly((value) => !value)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${openOnly ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-500"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${openOnly ? "bg-emerald-400" : "bg-slate-600"}`} />
              المفتوح فقط
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{rows.length} نتيجة حقيقية من السوق</span>
            <span>موقعك {Math.round(position.x)}، {Math.round(position.y)}</span>
          </div>

          {rows.length === 0 ? (
            <div className="grid h-56 place-items-center rounded-3xl border border-dashed border-white/10 text-center">
              <div>
                <Icon name="offers" size={38} className="mx-auto text-slate-700" />
                <p className="mt-3 text-sm font-bold text-slate-300">لا توجد عروض مطابقة</p>
                <p className="mt-1 text-xs text-slate-600">غيّر البحث أو الفلاتر لرؤية محلات أخرى</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ booth, distance }) => (
                <article key={booth.slot} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025] transition hover:border-white/20 hover:bg-white/[.045]">
                  <button type="button" onClick={() => onOpen(booth.slot)} className="block w-full text-right">
                    <div className="relative h-24 overflow-hidden bg-[#111d26]">
                      {booth.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={booth.logoUrl} alt={`لافتة ${booth.brand}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center gap-3 px-4" style={{ background: `linear-gradient(120deg,${booth.color}25,transparent 70%)` }}>
                          <span className="grid h-12 w-12 place-items-center rounded-2xl text-xl font-black text-[#0b151b]" style={{ backgroundColor: booth.color }}>{booth.brand.charAt(0)}</span>
                          <span className="text-xs font-semibold tracking-[.2em] text-slate-500">FARSHA STORE</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a111a] to-transparent" />
                      <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/55 px-2 py-1 font-mono text-[9px] text-slate-300">#{String(booth.slot).padStart(3, "0")}</span>
                      <span className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${booth.open ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-800/80 text-slate-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${booth.open ? "bg-emerald-400" : "bg-slate-500"}`} />
                        {booth.open ? "مفتوح الآن" : "مغلق مؤقتًا"}
                      </span>
                    </div>
                    <div className="p-3.5 pt-1">
                      <h3 className="truncate text-sm font-extrabold text-white">{booth.brand}</h3>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{categoryLabel(booth.category)} · {booth.ownerName}</p>
                      {booth.tagline ? <p className="mt-2 line-clamp-1 text-[11px] text-slate-300">{booth.tagline}</p> : null}
                      {booth.offer ? (
                        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-300/10 bg-amber-300/[.055] p-2.5">
                          <Icon name={booth.offer.kind === "service" ? "service" : "package"} size={17} className="shrink-0 text-amber-300" />
                          <span className="truncate text-[11px] font-bold text-amber-50">{booth.offer.name}</span>
                          {booth.offer.price ? <span className="mr-auto shrink-0 font-mono text-[11px] font-bold text-amber-300">{booth.offer.price}</span> : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-[10px] text-slate-600">لم يضف البائع عروضًا بعد</p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 border-t border-white/[.06] px-3 py-2.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><Icon name="walk" size={13} />{distance} م</span>
                    <span className="text-[10px] text-slate-600">{booth.productsCount} عرض</span>
                    <button type="button" onClick={() => onNavigate(booth.slot)} className="mr-auto flex items-center gap-1.5 rounded-xl bg-teal-400/10 px-3 py-1.5 text-[10px] font-bold text-teal-200 transition hover:bg-teal-400/20">
                      <Icon name="navigation" size={13} />خذني إليه
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${active ? "border-teal-300/40 bg-teal-300/10 text-teal-200" : "border-white/10 bg-white/[.02] text-slate-500 hover:text-slate-200"}`}>
      {label}
    </button>
  );
}
