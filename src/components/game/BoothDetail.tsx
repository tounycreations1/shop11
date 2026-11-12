"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { boothCenter, categoryLabel, zoneLabel, zoneNameAr } from "@/lib/game/constants";
import { apiBoothDetail } from "@/lib/game/client";
import type { BoothDetailDto, ProductKind } from "@/lib/game/types";

export default function BoothDetail({ slot, onNavigate, onClose }: {
  slot: number;
  onNavigate: (slot: number) => void;
  onClose: () => void;
}) {
  const [booth, setBooth] = useState<BoothDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"all" | ProductKind>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    const load = async (initial = false) => {
      try {
        const detail = await apiBoothDetail(slot, initial);
        if (cancelled) return;
        if (!detail) setNotFound(true);
        else { setNotFound(false); setBooth(detail); }
      } catch {
        if (!cancelled && initial) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load(true);
    const timer = window.setInterval(() => void load(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [slot]);

  const visibleItems = useMemo(() => booth?.products.filter((item) => tab === "all" || item.kind === tab) ?? [], [booth, tab]);
  const productCount = booth?.products.filter((item) => item.kind === "product").length ?? 0;
  const serviceCount = booth?.products.filter((item) => item.kind === "service").length ?? 0;
  const center = boothCenter(slot);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#02060b]/80 backdrop-blur-md sm:items-center sm:p-6">
      <section className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0a111a] shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:rounded-[30px]">
        <button type="button" onClick={onClose} className="absolute left-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/45 text-white backdrop-blur-lg transition hover:bg-black/70" aria-label="إغلاق"><Icon name="close" /></button>

        <div className="relative h-44 overflow-hidden bg-[#101d27] sm:h-52">
          {booth?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={booth.logoUrl} alt={`لافتة ${booth.brand}`} className="h-full w-full object-cover" />
          ) : (
            <div className="relative flex h-full items-center justify-center overflow-hidden" style={{ background: `radial-gradient(circle at 50% 30%,${booth?.color ?? "#2dd4bf"}30,transparent 60%),linear-gradient(140deg,#152731,#0a111a)` }}>
              <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(30deg,transparent_48%,rgba(255,255,255,.15)_49%,rgba(255,255,255,.15)_51%,transparent_52%)] [background-size:32px_32px]" />
              <span className="grid h-24 w-24 place-items-center rounded-[28px] border border-white/20 text-5xl font-black text-[#0b161c] shadow-2xl" style={{ backgroundColor: booth?.color ?? "#2dd4bf" }}>{booth?.brand.charAt(0) ?? slot}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a111a] via-[#0a111a]/20 to-black/10" />
          <div className="absolute bottom-4 right-5 left-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-white/10 bg-black/35 px-2 py-1 font-mono text-[10px] text-slate-300 backdrop-blur">UNIT {String(slot).padStart(3, "0")}</span>
              {booth ? <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur ${booth.open ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-800/70 text-slate-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${booth.open ? "bg-emerald-400" : "bg-slate-500"}`} />{booth.open ? "مفتوح · البائع في السوق" : "مغلق مؤقتًا"}</span> : null}
            </div>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{booth?.brand ?? `المحل ${slot}`}</h2>
            {booth ? <p className="mt-1 text-[11px] text-slate-400">{categoryLabel(booth.category)} · رواق {zoneNameAr(slot)} {zoneLabel(slot)} · {booth.ownerName}</p> : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading && !booth ? <p className="py-12 text-center text-sm text-slate-500">جاري فتح واجهة المحل…</p> : notFound ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[.02] p-7 text-center">
              <Icon name="shop" size={38} className="mx-auto text-slate-600" />
              <p className="mt-3 text-base font-extrabold text-white">هذا المحل متاح للإيجار</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">لم يُؤجَّر هذا المحل بعد. يمكنك الذهاب إلى موقعه، أو الضغط على لافتته داخل السوق لاستئجاره.</p>
              <button type="button" onClick={() => onNavigate(slot)} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-teal-300 px-4 py-2.5 text-xs font-black text-teal-950"><Icon name="navigation" size={16} />اذهب إلى موقع المحل</button>
            </div>
          ) : booth ? (
            <>
              {booth.tagline ? <p className="border-r-2 pr-3 text-sm font-bold leading-relaxed text-amber-100" style={{ borderColor: booth.color }}>{booth.tagline}</p> : null}
              {booth.description ? <p className="mt-3 text-xs leading-7 text-slate-400">{booth.description}</p> : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-white/[.07] py-3">
                <div className="flex rounded-2xl bg-black/25 p-1">
                  <TabButton active={tab === "all"} onClick={() => setTab("all")} icon="offers" label={`الكل ${booth.products.length}`} />
                  <TabButton active={tab === "product"} onClick={() => setTab("product")} icon="package" label={`منتجات ${productCount}`} />
                  <TabButton active={tab === "service"} onClick={() => setTab("service")} icon="service" label={`خدمات ${serviceCount}`} />
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><Icon name="eye" size={14} />{booth.visits} مشاهدة حقيقية</span>
              </div>

              {visibleItems.length === 0 ? (
                <div className="py-10 text-center"><Icon name="package" size={32} className="mx-auto text-slate-700" /><p className="mt-2 text-xs text-slate-600">لا توجد عروض في هذا القسم بعد</p></div>
              ) : (
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {visibleItems.map((item) => (
                    <article key={item.id} className={`rounded-2xl border p-3.5 transition ${item.featured ? "border-amber-300/25 bg-amber-300/[.055]" : "border-white/[.07] bg-white/[.025] hover:bg-white/[.04]"}`}>
                      <div className="flex items-start gap-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.featured ? "bg-amber-300/15 text-amber-300" : "bg-white/5 text-slate-400"}`}><Icon name={item.kind === "service" ? "service" : "package"} size={17} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2"><h3 className="truncate text-xs font-extrabold text-white">{item.name}</h3>{item.featured ? <Icon name="star" size={12} className="shrink-0 text-amber-300" /> : null}</div>
                          {item.detail ? <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{item.detail}</p> : null}
                        </div>
                        {item.price ? <span className="shrink-0 rounded-lg bg-amber-300/10 px-2 py-1 font-mono text-[11px] font-bold text-amber-200">{item.price}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[.07] pt-4">
                <button type="button" onClick={() => onNavigate(slot)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-teal-300 to-emerald-400 px-4 py-3 text-xs font-black text-teal-950 transition hover:brightness-110"><Icon name="navigation" size={17} />وجّهني إلى المحل</button>
                {booth.contact ? <span className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.025] px-4 py-3 text-[11px] text-slate-300"><Icon name="phone" size={15} className="text-teal-300" />{booth.contact}</span> : null}
                <span className="mr-auto flex items-center gap-1.5 text-[9px] text-slate-600"><Icon name="map" size={13} />{Math.round(center.x)}، {Math.round(center.y)}</span>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold transition ${active ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}><Icon name={icon} size={14} />{label}</button>;
}
