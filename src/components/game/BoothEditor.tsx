"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

import GenderPicker from "@/components/game/GenderPicker";
import { Icon } from "@/components/ui/Icon";
import {
  CATEGORIES,
  MAX_BRAND,
  MAX_DESCRIPTION,
  MAX_PRODUCTS,
  MAX_TAGLINE,
  SHOP_THEMES,
} from "@/lib/game/constants";
import {
  apiBoothAction,
  apiOwnerBooth,
  apiUploadSign,
  type BoothDraft,
  type ClientSession,
  type DraftProduct,
} from "@/lib/game/client";
import type { BoothDetailDto, Gender, ProductDto, ProductKind } from "@/lib/game/types";

export type BoothEditorProps = {
  mode: "setup" | "manage";
  session: ClientSession;
  slot: number | null;
  booth?: BoothDetailDto | null;
  /** Setup mode: the representative chosen on the parent page. */
  avatarGender?: Gender;
  onReady?: (draft: BoothDraft, products: DraftProduct[], slot: number | null) => void;
  onBoothChange?: (booth: BoothDetailDto) => void;
  onGoToBooth?: (slot: number) => void;
  onReleased?: () => void;
  busy?: boolean;
};

type FormState = BoothDraft & { liveMessage: string };
const EMPTY_FORM: FormState = {
  brandName: "", category: "other", tagline: "", description: "", contact: "",
  emoji: "", logoUrl: "", color: "teal", avatarGender: "male", liveMessage: "",
};

function fromBooth(booth: BoothDetailDto): FormState {
  return {
    brandName: booth.brand, category: booth.category, tagline: booth.tagline,
    description: booth.description, contact: booth.contact, emoji: "", logoUrl: booth.logoUrl,
    color: SHOP_THEMES.find((theme) => theme.trim === booth.color)?.key ?? "teal",
    avatarGender: booth.avatarGender,
    liveMessage: booth.liveMessage,
  };
}

export default function BoothEditor({
  mode, session, slot, booth, avatarGender, onReady, onBoothChange, onGoToBooth, onReleased, busy = false,
}: BoothEditorProps) {
  const [form, setForm] = useState<FormState>(() => booth ? fromBooth(booth) : EMPTY_FORM);
  const [items, setItems] = useState<ProductDto[]>(booth?.products ?? []);
  const [newItem, setNewItem] = useState<DraftProduct>({ kind: "product", name: "", price: "", detail: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (mode !== "manage" || slot === null) return;
    let cancelled = false;
    void apiOwnerBooth(slot, session).then((detail) => {
      if (!cancelled && detail) { setForm(fromBooth(detail)); setItems(detail.products); }
    }).catch(() => undefined);
    return () => { cancelled = true; };
    // Load once; never overwrite text while the seller is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slot]);

  const run = async (action: Parameters<typeof apiBoothAction>[0], payload: Record<string, unknown>) => {
    setSaving(true);
    setStatus(null);
    const result = await apiBoothAction(action, session, payload);
    setSaving(false);
    if (result.error) {
      const messages: Record<string, string> = {
        slot_taken: "هذا المحل محجوز، اختر محلًا آخر.", already_owns: "لديك محل محجوز بالفعل.",
        no_free_slot: "كل المحلات محجوزة.", invalid_brand: "اكتب اسم براند صحيحًا.",
        too_many_products: `الحد الأقصى ${MAX_PRODUCTS} عرضًا.`, invalid_product: "اكتب اسم العرض.",
        not_owner: "هذا المحل ليس ملكك.", unauthorized: "انتهت الجلسة، أعد الدخول.",
      };
      setStatus(messages[result.error] ?? "تعذّر تنفيذ الطلب.");
      return null;
    }
    return result;
  };

  const draftOf = (value: FormState): BoothDraft => ({
    brandName: value.brandName, category: value.category, tagline: value.tagline,
    description: value.description, contact: value.contact, emoji: "",
    logoUrl: value.logoUrl, color: value.color,
    avatarGender: mode === "setup" ? (avatarGender ?? value.avatarGender) : value.avatarGender,
  });

  const persistSign = async (value: FormState, successMessage = "تم حفظ اللافتة ونشرها في السوق") => {
    if (value.brandName.trim().length < 2) { setStatus("اكتب اسم البراند أولًا."); return null; }
    const result = await run("update", { slot, ...draftOf(value) });
    if (result) {
      setStatus(successMessage);
      if (slot !== null) {
        const detail = await apiOwnerBooth(slot, session);
        if (detail && onBoothChange) onBoothChange(detail);
      }
    }
    return result;
  };

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setStatus("جاري تجهيز الصورة وضغطها…");
    try {
      const logoUrl = await apiUploadSign(file);
      const next = { ...form, logoUrl };
      setForm(next);
      if (mode === "manage") await persistSign(next, "تم رفع اللافتة الجديدة ونشرها مباشرة");
      else setStatus("الصورة جاهزة وستظهر على واجهة محلك");
    } catch (error) {
      const code = error instanceof Error ? error.message : "upload_failed";
      setStatus(code === "file_too_large" ? "الصورة كبيرة جدًا." : code === "unsupported_type" ? "استخدم صورة JPG أو PNG أو WebP." : "تعذّر رفع الصورة، حاول مرة أخرى.");
    } finally {
      setUploading(false);
      setDragging(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void uploadFile(event.dataTransfer.files[0]);
  };

  const addProduct = async () => {
    if (newItem.name.trim().length < 2) { setStatus("اكتب اسم المنتج أو الخدمة."); return; }
    if (mode === "setup") {
      setItems([...items, {
        id: `local-${Date.now()}-${items.length}`, kind: newItem.kind, name: newItem.name.trim(),
        price: newItem.price.trim(), detail: newItem.detail.trim(), featured: items.length === 0,
      }]);
      setNewItem({ kind: newItem.kind, name: "", price: "", detail: "" });
      setStatus("أُضيف العرض إلى قائمة محلك");
      return;
    }
    const result = await run("product.add", { slot, ...newItem });
    if (result) {
      setItems(result.products ?? []);
      setNewItem({ kind: newItem.kind, name: "", price: "", detail: "" });
      setStatus("نُشر العرض الجديد للزوار");
    }
  };

  const removeProduct = async (productId: string) => {
    if (mode === "setup") { setItems(items.filter((item) => item.id !== productId)); return; }
    const result = await run("product.remove", { slot, productId });
    if (result) setItems(result.products ?? []);
  };

  const featureProduct = async (productId: string) => {
    if (mode === "setup") {
      setItems(items.map((item) => ({ ...item, featured: item.id === productId })));
      return;
    }
    const result = await run("product.feature", { slot, productId });
    if (result) setItems(result.products ?? []);
  };

  const broadcast = async () => {
    const result = await run("live", { slot, message: form.liveMessage });
    if (result) setStatus(form.liveMessage ? "العرض ظاهر الآن على زجاج محلك بجوار الباب" : "تم إيقاف البث");
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><Icon name="image" /></span>
          <div><h3 className="text-sm font-extrabold text-white">واجهة المحل واللافتة</h3><p className="text-[11px] text-slate-500">صورة عريضة تعبّر عن البراند وتظهر على المبنى مباشرة</p></div>
        </div>

        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative overflow-hidden rounded-2xl border transition ${dragging ? "border-teal-300 bg-teal-300/10" : "border-dashed border-white/15 bg-black/20"}`}
        >
          {form.logoUrl ? (
            <div className="relative aspect-[1000/360] max-h-44 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logoUrl} alt="معاينة لافتة المحل" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-black/60 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">تغيير الصورة</button>
                <button type="button" onClick={() => { const next = { ...form, logoUrl: "" }; setForm(next); if (mode === "manage") void persistSign(next); }} className="rounded-xl bg-rose-500/70 px-3 py-1.5 text-[10px] font-bold text-white">إزالة</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center transition hover:bg-white/[.025]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/10 text-teal-300"><Icon name="upload" size={22} /></span>
              <span className="text-xs font-bold text-slate-200">{uploading ? "جاري رفع الصورة…" : "ارفع صورة اللافتة"}</span>
              <span className="text-[10px] leading-relaxed text-slate-500">اسحبها هنا أو اختر من الجهاز · JPG / PNG / WebP<br />يتم تصغيرها تلقائيًا إلى 1000×360 للحفاظ على سرعة السوق</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFile(event.target.files?.[0])} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`اسم البراند · ${MAX_BRAND} حرفًا`}>
            <input value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value.slice(0, MAX_BRAND) })} placeholder="مثال: بيت التمر" className="input" />
          </Field>
          <Field label="القسم">
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="input appearance-none">
              {CATEGORIES.map((category) => <option key={category.key} value={category.key} className="bg-slate-900">{category.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="لون واجهة المحل" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {SHOP_THEMES.map((theme) => (
              <button key={theme.key} type="button" onClick={() => setForm({ ...form, color: theme.key })} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[10px] font-bold transition ${form.color === theme.key ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-slate-500"}`}>
                <span className="h-4 w-4 rounded-md border border-white/20" style={{ background: `linear-gradient(135deg,${theme.trim},${theme.awning})` }} />{theme.key}
              </button>
            ))}
          </div>
        </Field>

        {mode === "manage" ? (
          <Field label="الشخص الذي يمثّل محلك أمام الباب" className="mt-4">
            <GenderPicker
              value={form.avatarGender}
              disabled={saving}
              onChange={(gender) => {
                const next = { ...form, avatarGender: gender };
                setForm(next);
                void persistSign(next, "تم تغيير الشخص الذي يمثّل محلك");
              }}
            />
          </Field>
        ) : null}

        <Field label={`الجملة التعريفية · ${MAX_TAGLINE} حرفًا`} className="mt-4">
          <input value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value.slice(0, MAX_TAGLINE) })} placeholder="ما الذي يميّز محلك؟" className="input" />
        </Field>
        <Field label={`وصف المحل · ${MAX_DESCRIPTION} حرفًا`} className="mt-4">
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value.slice(0, MAX_DESCRIPTION) })} rows={3} placeholder="احكِ للزائر قصة البراند وما سيجده لديك…" className="input resize-none" />
        </Field>
        <Field label="التواصل · اختياري" className="mt-4">
          <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value.slice(0, 48) })} placeholder="حساب أو رقم تواصل" className="input" />
        </Field>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-300/10 text-teal-300"><Icon name="offers" /></span>
          <div><h3 className="text-sm font-extrabold text-white">المنتجات والخدمات</h3><p className="text-[11px] text-slate-500">{items.length}/{MAX_PRODUCTS} عرض · المنتج المميّز ⭐ يظهر بجانب محلك مع زر «المزيد»</p></div>
        </div>

        <div className="mb-3 flex rounded-2xl border border-white/10 bg-black/20 p-1">
          {(["product", "service"] as ProductKind[]).map((kind) => (
            <button key={kind} type="button" onClick={() => setNewItem({ ...newItem, kind })} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[11px] font-bold transition ${newItem.kind === kind ? "bg-teal-300/15 text-teal-200" : "text-slate-500"}`}>
              <Icon name={kind === "product" ? "package" : "service"} size={16} />{kind === "product" ? "منتج" : "خدمة"}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <input value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value.slice(0, 44) })} placeholder={newItem.kind === "product" ? "اسم المنتج" : "اسم الخدمة"} className="input text-xs" />
          <input value={newItem.price} onChange={(event) => setNewItem({ ...newItem, price: event.target.value.slice(0, 24) })} placeholder="السعر" className="input text-xs" />
          <button type="button" onClick={() => void addProduct()} disabled={saving || items.length >= MAX_PRODUCTS} className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-300 px-4 py-2 text-xs font-black text-teal-950 transition hover:bg-teal-200 disabled:opacity-40"><Icon name="plus" size={15} />إضافة</button>
        </div>
        <input value={newItem.detail} onChange={(event) => setNewItem({ ...newItem, detail: event.target.value.slice(0, 160) })} placeholder="تفاصيل العرض، المقاس، المدة أو الوزن…" className="input mt-2 text-xs" />

        <div className="mt-3 flex max-h-60 flex-col gap-2 overflow-y-auto">
          {items.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 py-5 text-center text-[11px] text-slate-600">أضف أول منتج أو خدمة ليظهر في دليل العروض</p> : null}
          {items.map((item) => (
            <div key={item.id} className={`flex items-center gap-2 rounded-2xl border p-2.5 ${item.featured ? "border-amber-300/25 bg-amber-300/[.06]" : "border-white/[.07] bg-black/20"}`}>
              <Icon name={item.kind === "service" ? "service" : "package"} size={17} className={item.featured ? "text-amber-300" : "text-slate-500"} />
              <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{item.name}</p>{item.detail ? <p className="truncate text-[10px] text-slate-500">{item.detail}</p> : null}</div>
              {item.price ? <span className="shrink-0 font-mono text-[11px] font-bold text-amber-200">{item.price}</span> : null}
              <div className="mr-auto flex shrink-0 gap-1">
                <button type="button" title="اجعله المنتج الظاهر بجانب المحل" onClick={() => void featureProduct(item.id)} className={`grid h-7 w-7 place-items-center rounded-lg ${item.featured ? "bg-amber-300/15 text-amber-300" : "bg-white/5 text-slate-500 hover:text-amber-300"}`}><Icon name="star" size={13} /></button>
                <button type="button" title="حذف" onClick={() => void removeProduct(item.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"><Icon name="trash" size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {mode === "manage" ? (
        <section className="rounded-3xl border border-rose-300/20 bg-rose-400/[.055] p-4">
          <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-400/10 text-rose-300"><Icon name="live" /></span><div><h3 className="text-sm font-extrabold text-white">إعلان مباشر من المحل</h3><p className="text-[11px] text-rose-200/50">يظهر على زجاج محلك بجوار الباب فقط (ليس في بقية السوق)</p></div></div>
          <div className="flex gap-2">
            <input value={form.liveMessage} onChange={(event) => setForm({ ...form, liveMessage: event.target.value.slice(0, 80) })} placeholder="مثال: خصم خاص لزوار السوق اليوم" className="input flex-1 text-xs" />
            <button type="button" onClick={() => void broadcast()} disabled={saving} className="rounded-xl bg-rose-400 px-4 text-xs font-black text-rose-950 transition hover:bg-rose-300 disabled:opacity-40">بث الآن</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void persistSign(form)} disabled={saving || uploading} className="flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-black text-amber-950 disabled:opacity-40"><Icon name="check" size={15} />حفظ واجهة المحل</button>
            {slot !== null && onGoToBooth ? <button type="button" onClick={() => onGoToBooth(slot)} className="flex items-center gap-2 rounded-xl border border-teal-300/25 bg-teal-300/10 px-4 py-2.5 text-xs font-bold text-teal-200"><Icon name="navigation" size={15} />الذهاب إلى محلي</button> : null}
            <button type="button" onClick={() => void run("release", { slot }).then((result) => { if (result) onReleased?.(); })} disabled={saving} className="flex items-center gap-2 rounded-xl border border-rose-300/20 px-4 py-2.5 text-xs font-bold text-rose-300"><Icon name="trash" size={15} />إخلاء المحل</button>
          </div>
        </section>
      ) : null}

      {status ? <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-slate-300"><Icon name="spark" size={15} className="shrink-0 text-teal-300" />{status}</p> : null}

      {mode === "setup" ? (
        <button type="button" disabled={busy || saving || uploading || form.brandName.trim().length < 2} onClick={() => onReady?.(draftOf(form), items.map((item) => ({ kind: item.kind, name: item.name, price: item.price, detail: item.detail })), slot)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-300 to-orange-400 px-5 py-4 text-sm font-black text-amber-950 shadow-[0_16px_40px_rgba(245,158,11,.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
          <Icon name="seller" size={20} />{busy ? "جاري تجهيز المحل…" : "احجز المحل وافتح أبوابك"}
        </button>
      ) : null}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className}><p className="mb-1.5 text-[10px] font-bold text-slate-500">{label}</p>{children}</div>;
}
