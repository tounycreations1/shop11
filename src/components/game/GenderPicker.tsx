"use client";

import { Icon } from "@/components/ui/Icon";
import type { Gender } from "@/lib/game/types";

const OPTIONS: { key: Gender; label: string; hint: string }[] = [
  { key: "male", label: "ذكر", hint: "شخصية رجل" },
  { key: "female", label: "أنثى", hint: "شخصية محجبة" },
];

/** Two big icon buttons: male or (veiled) female. */
export default function GenderPicker({
  value,
  onChange,
  size = "md",
  disabled = false,
}: {
  value: Gender | null;
  onChange: (gender: Gender) => void;
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  const big = size === "lg";
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="اختيار الشخصية">
      {OPTIONS.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.key)}
            className={`group flex flex-col items-center gap-2 rounded-3xl border text-center transition disabled:opacity-40 ${big ? "p-5" : "p-3"} ${
              active
                ? "border-teal-300/70 bg-teal-300/15 shadow-[0_0_30px_rgba(45,212,191,.15)]"
                : "border-white/10 bg-white/[.03] hover:border-white/30 hover:bg-white/[.06]"
            }`}
          >
            <span
              className={`grid place-items-center rounded-2xl transition group-hover:scale-105 ${big ? "h-20 w-20" : "h-14 w-14"} ${
                active ? "bg-teal-300 text-teal-950" : "bg-white/10 text-slate-200"
              }`}
            >
              <Icon name={option.key} size={big ? 46 : 32} strokeWidth={1.6} />
            </span>
            <span className={`font-black text-white ${big ? "text-base" : "text-sm"}`}>{option.label}</span>
            <span className="text-[10px] text-slate-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
