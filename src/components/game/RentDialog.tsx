"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { ADMIN_WHATSAPP } from "@/lib/game/constants";

/**
 * "متاح للإيجار" flow: [استأجر الآن | رجوع] -> contact the management on WhatsApp.
 */
export default function RentDialog({ slot, onClose }: { slot: number; onClose: () => void }) {
  const [step, setStep] = useState<"choice" | "contact">("choice");
  const text = `السلام عليكم، أرغب في استئجار المحل رقم ${slot} في سوق فرشة. أرجو التواصل معي بخصوص التفاصيل.`;
  const link = ADMIN_WHATSAPP ? `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02060f]/80 p-4 backdrop-blur-md" onClick={onClose}>
      <section
        className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#081426] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.65)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {step === "choice" ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/15 text-amber-300"><Icon name="shop" size={28} /></span>
            <p className="mt-4 font-mono text-[10px] tracking-widest text-slate-500">UNIT {String(slot).padStart(3, "0")}</p>
            <h2 className="mt-1 text-xl font-black text-white">متاح للإيجار</h2>
            <p className="mt-2 text-xs leading-6 text-slate-400">هذا المحل جاهز ولم يُؤجَّر بعد. هل تريد استئجاره؟</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStep("contact")} className="rounded-2xl bg-gradient-to-l from-amber-300 to-orange-400 px-4 py-3 text-sm font-black text-amber-950 transition hover:brightness-110">استأجر الآن</button>
              <button type="button" onClick={onClose} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10">رجوع</button>
            </div>
          </>
        ) : (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Icon name="whatsapp" size={28} /></span>
            <h2 className="mt-4 text-xl font-black text-white">تواصل مع الإدارة</h2>
            <p className="mt-2 text-xs leading-6 text-slate-400">سنفتح لك محادثة واتساب مع إدارة السوق لإتمام استئجار المحل رقم {slot}.</p>
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-emerald-950 transition hover:bg-emerald-400">
                <Icon name="whatsapp" size={20} />تواصل عبر واتساب
              </a>
            ) : (
              <p className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-xs leading-6 text-amber-200">رقم واتساب الإدارة غير مُعدّ بعد. (يُضبط من المتغير NEXT_PUBLIC_ADMIN_WHATSAPP)</p>
            )}
            <button type="button" onClick={() => setStep("choice")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"><Icon name="back" size={16} />رجوع</button>
          </>
        )}
      </section>
    </div>
  );
}
