"use client";

import { useEffect, useState } from "react";

import GenderPicker from "@/components/game/GenderPicker";
import { FarshaMark, Icon } from "@/components/ui/Icon";
import { BOOTH_COUNT } from "@/lib/game/constants";
import { apiMarket } from "@/lib/game/client";
import type { Gender, MarketStats } from "@/lib/game/types";

export type LandingProps = {
  name: string;
  onNameChange: (value: string) => void;
  onEnterVisitor: (gender: Gender) => void;
  onEnterSeller: () => void;
  busy: boolean;
  error: string | null;
  sellerResumeSlot?: number | null;
};

export default function Landing({ name, onNameChange, onEnterVisitor, onEnterSeller, busy, error, sellerResumeSlot = null }: LandingProps) {
  const [stats, setStats] = useState<MarketStats>({ online: 0, visitors: 0, sellers: 0, takenBooths: 0, openBooths: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiMarket();
        if (!cancelled) setStats(data.stats);
      } catch { /* presence is best effort */ }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const [pickingGender, setPickingGender] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const free = Math.max(0, BOOTH_COUNT - stats.takenBooths);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b11]">
      <div className="hero-market absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/farsha-market-hero.jpg')" }} />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,13,.97)_0%,rgba(3,8,13,.80)_38%,rgba(3,8,13,.34)_72%,rgba(3,8,13,.60)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#050b11_0%,transparent_38%,rgba(3,8,13,.35)_100%)]" />
      <div className="absolute inset-0 opacity-[.055] [background-image:linear-gradient(rgba(255,255,255,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.25)_1px,transparent_1px)] [background-size:70px_70px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <FarshaMark size={42} className="text-amber-50" />
          <div><p className="text-xl font-black leading-none text-white">فرشة</p><p className="mt-1 text-[8px] font-semibold tracking-[.34em] text-amber-200/70">FARSHA MARKET</p></div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-slate-300 backdrop-blur-xl">
          <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
          {stats.online} شخص داخل السوق الآن
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[1fr_460px] lg:items-center lg:gap-16 lg:pt-14">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/[.07] px-3 py-1.5 text-[10px] font-bold text-amber-100 backdrop-blur">
            <Icon name="spark" size={14} />سوق رقمي حيّ، وليس قائمة متاجر
          </div>
          <h1 className="mt-6 text-[clamp(2.8rem,6vw,5.7rem)] font-black leading-[1.02] tracking-tight text-white">
            امشِ بين المحلات.<br /><span className="bg-gradient-to-l from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">اكتشف عرضك القادم.</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-8 text-slate-300 sm:text-base">
            شارع واحد يجمع الجميع في اللحظة نفسها. افتح واجهة أي محل، شاهد منتجاته وخدماته وإعلاناته المباشرة، ثم اتبع الاتجاهات حتى تقف أمام بابه.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <Metric icon="shop" value={`${stats.takenBooths}/${BOOTH_COUNT}`} label="محل على الواجهة" />
            <Metric icon="live" value={stats.openBooths} label="محل مفتوح الآن" />
            <Metric icon="users" value={stats.visitors} label="زائر يتجوّل" />
          </div>

          <div className="mt-8 hidden items-center gap-6 text-[10px] text-slate-400 md:flex">
            <span className="flex items-center gap-2"><Icon name="walk" size={17} className="text-teal-300" />حركة حرّة داخل الشارع</span>
            <span className="flex items-center gap-2"><Icon name="image" size={17} className="text-teal-300" />لافتات بصور حقيقية</span>
            <span className="flex items-center gap-2"><Icon name="navigation" size={17} className="text-teal-300" />دليل عروض واتجاهات</span>
          </div>
        </section>

        <section className="rounded-[30px] border border-white/15 bg-[#09121b]/80 p-5 shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-6">
          <div className="mb-5"><p className="text-lg font-black text-white">ادخل إلى فرشة</p><p className="mt-1 text-[11px] text-slate-500">اختر اسمك ثم حدّد كيف تريد خوض التجربة</p></div>
          <label className="text-[10px] font-bold text-slate-400">الاسم الظاهر للآخرين</label>
          <input value={name} onChange={(event) => onNameChange(event.target.value.slice(0, 16))} placeholder="اكتب اسمك" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/10" />

          {pickingGender ? (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between">
                <div><p className="text-base font-black text-white">اختر شخصيتك</p><p className="mt-1 text-[11px] text-slate-500">هكذا سيراك الجميع أثناء تجوّلك في السوق</p></div>
                <button type="button" onClick={() => setPickingGender(false)} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"><Icon name="back" size={14} className="rotate-180" />رجوع</button>
              </div>
              <GenderPicker value={gender} onChange={setGender} size="lg" disabled={busy} />
              <button type="button" disabled={busy || !gender || name.trim().length < 2} onClick={() => gender && onEnterVisitor(gender)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-teal-300 to-emerald-400 px-5 py-4 text-sm font-black text-teal-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                <Icon name="walk" size={19} />{busy ? "جاري الدخول…" : "ادخل السوق"}
              </button>
            </div>
          ) : (
          <div className="mt-5 flex flex-col gap-3">
            <button type="button" disabled={busy || name.trim().length < 2} onClick={() => setPickingGender(true)} className="group relative overflow-hidden rounded-3xl border border-teal-300/25 bg-gradient-to-l from-teal-300/15 to-emerald-400/[.06] p-4 text-right transition hover:border-teal-300/55 hover:from-teal-300/25 disabled:cursor-not-allowed disabled:opacity-40">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-300 text-teal-950 shadow-[0_10px_30px_rgba(45,212,191,.2)] transition group-hover:scale-105"><Icon name="visitor" size={28} /></span>
                <div className="flex-1"><div className="flex items-center justify-between"><h2 className="text-base font-black text-white">أنا زائر</h2><Icon name="arrow" size={19} className="rotate-180 text-teal-300 transition group-hover:-translate-x-1" /></div><p className="mt-1 text-[11px] leading-relaxed text-slate-400">تجوّل مباشرة، افتح المحلات واستكشف العروض</p></div>
              </div>
            </button>

            <button type="button" disabled={busy || name.trim().length < 2} onClick={onEnterSeller} className="group relative overflow-hidden rounded-3xl border border-amber-300/25 bg-gradient-to-l from-amber-300/15 to-orange-400/[.06] p-4 text-right transition hover:border-amber-300/55 hover:from-amber-300/25 disabled:cursor-not-allowed disabled:opacity-40">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-300 text-amber-950 shadow-[0_10px_30px_rgba(245,158,11,.2)] transition group-hover:scale-105"><Icon name="seller" size={28} /></span>
                <div className="flex-1"><div className="flex items-center justify-between"><h2 className="text-base font-black text-white">{sellerResumeSlot ? "العودة إلى محلي" : "أنا بائع"}</h2><Icon name="arrow" size={19} className="rotate-180 text-amber-300 transition group-hover:-translate-x-1" /></div><p className="mt-1 text-[11px] leading-relaxed text-slate-400">{sellerResumeSlot ? `استأنف إدارة المحل #${sellerResumeSlot} وافتح أبوابه` : "احجز محلًا، ارفع لافتتك وانشر عروضك"}</p></div>
              </div>
              <p className="mt-3 border-t border-white/[.07] pt-2 text-[9px] font-bold text-amber-200/70">{free} محل متاح من أصل {BOOTH_COUNT}</p>
            </button>
          </div>
          )}

          {error ? <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2.5 text-xs leading-relaxed text-rose-200">{error}</p> : null}
          <p className="mt-5 text-center text-[9px] leading-relaxed text-slate-600">يعمل من المتصفح على الكمبيوتر والموبايل · كل جهاز يظهر كشخص مستقل داخل الشارع نفسه</p>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: "shop" | "live" | "users"; value: string | number; label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl"><Icon name={icon} size={17} className="mb-2 text-amber-300" /><p className="font-mono text-xl font-black text-white">{value}</p><p className="mt-1 text-[9px] text-slate-500">{label}</p></div>;
}
