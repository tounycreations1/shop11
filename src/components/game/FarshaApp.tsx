"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import BoothDetail from "@/components/game/BoothDetail";
import BoothEditor from "@/components/game/BoothEditor";
import Landing from "@/components/game/Landing";
import GenderPicker from "@/components/game/GenderPicker";
import MarketCanvas from "@/components/game/MarketCanvas";
import RentDialog from "@/components/game/RentDialog";
import SlotPicker from "@/components/game/SlotPicker";
import {
  apiBoothAction,
  apiJoin,
  apiLeave,
  detectDevice,
  type BoothDraft,
  type ClientSession,
  type DraftProduct,
} from "@/lib/game/client";
import { boothStandingPoint } from "@/lib/game/constants";
import { FarshaMark, Icon } from "@/components/ui/Icon";
import type { Gender, Role, SessionPayload } from "@/lib/game/types";

type Phase = "landing" | "seller-setup" | "world";

const SELLER_STORAGE_KEY = "farsha.seller.session.v2";
const RANDOM_NAMES = ["Wanderer", "Nomad", "Pioneer", "Drifter", "Voyager", "Echo", "Nova", "Pixel"];

export default function FarshaApp() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [name, setName] = useState("");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [detailSlot, setDetailSlot] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [setupSlot, setSetupSlot] = useState<number | null>(null);
  const [rentSlot, setRentSlot] = useState<number | null>(null);
  const [repGender, setRepGender] = useState<Gender>("male");
  const [savedSeller, setSavedSeller] = useState<SessionPayload | null>(null);
  const deviceRef = useRef<"desktop" | "mobile" | "tablet">("desktop");

  useEffect(() => {
    deviceRef.current = detectDevice();
    try {
      const stored = window.localStorage.getItem(SELLER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionPayload;
        if (parsed.id && parsed.secret && parsed.role === "seller") {
          setSavedSeller(parsed);
          setName(parsed.name);
          return;
        }
      }
    } catch { /* a fresh identity is created below */ }
    setName(
      `${RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]}-${Math.floor(100 + Math.random() * 899)}`,
    );
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (phase === "world") setPanelOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [phase]);

  const enterWorld = useCallback((payload: SessionPayload, x: number, y: number) => {
    setSession(payload);
    setStart({ x, y });
    setPhase("world");
  }, []);

  const enterAsVisitor = useCallback(async (gender: Gender) => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiJoin({
        name: name.trim(),
        device: deviceRef.current,
        role: "visitor" satisfies Role,
        gender,
      });
      enterWorld(data.session, data.x, data.y);
    } catch {
      setError("تعذّر الدخول إلى السوق. تحقق من الاتصال وحاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }, [enterWorld, name]);

  const claimAndEnter = useCallback(
    async (draft: BoothDraft, products: DraftProduct[], slot: number | null) => {
      setBusy(true);
      setError(null);
      try {
        // 1) join the shared world as a seller
        const joined = await apiJoin({
          name: name.trim(),
          device: deviceRef.current,
          role: "seller" satisfies Role,
          gender: draft.avatarGender,
        });

        // 2) book one of the 100 street units and put the brand sign on it
        const sessionForClaim: ClientSession = joined.session;
        const result = await apiBoothAction("claim", sessionForClaim, {
          slot,
          auto: slot === null,
          ...draft,
          products,
        });

        if (result.error) {
          const messages: Record<string, string> = {
            slot_taken: "شخص آخر حجز هذا المكان قبل لحظة — اختر مكانًا آخر.",
            no_free_slot: "كل الأماكن محجوزة حاليًا.",
            invalid_brand: "اكتب اسم براند صحيح.",
            already_owns: "لديك مكان محجوز بالفعل.",
          };
          setError(messages[result.error] ?? "تعذّر حجز المكان.");
          await apiLeave(joined.session);
          return;
        }

        const claimedSlot = result.slot ?? slot ?? 0;
        const standing = boothStandingPoint(claimedSlot);
        const sellerSession = { ...joined.session, role: "seller" as const, boothSlot: claimedSlot };
        try {
          window.localStorage.setItem(SELLER_STORAGE_KEY, JSON.stringify(sellerSession));
        } catch { /* storage can be disabled in private mode */ }
        setSavedSeller(sellerSession);
        enterWorld(sellerSession, standing.x, standing.y);
        setTargetSlot(claimedSlot);
      } catch {
        setError("تعذّر بدء البيع. تحقق من الاتصال وحاول مرة أخرى.");
      } finally {
        setBusy(false);
      }
    },
    [enterWorld, name],
  );


  const enterAsSeller = useCallback(async () => {
    setError(null);
    if (!savedSeller?.boothSlot) {
      setPhase("seller-setup");
      return;
    }
    setBusy(true);
    try {
      const data = await apiJoin({
        name: name.trim() || savedSeller.name,
        device: deviceRef.current,
        role: "seller",
        resumeId: savedSeller.id,
        resumeSecret: savedSeller.secret,
      });
      const resumed = data.session;
      if (!resumed.boothSlot) {
        setSavedSeller(null);
        try { window.localStorage.removeItem(SELLER_STORAGE_KEY); } catch { /* no-op */ }
        setPhase("seller-setup");
        return;
      }
      setSavedSeller(resumed);
      try { window.localStorage.setItem(SELLER_STORAGE_KEY, JSON.stringify(resumed)); } catch { /* no-op */ }
      const standing = resumed.boothSlot ? boothStandingPoint(resumed.boothSlot) : { x: data.x, y: data.y };
      enterWorld(resumed, standing.x, standing.y);
      if (resumed.boothSlot) setTargetSlot(resumed.boothSlot);
    } catch {
      setError("تعذّر استعادة محلك. يمكنك المحاولة مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }, [enterWorld, name, savedSeller]);

  /* ------------------------------- landing ------------------------------- */
  if (phase === "landing") {
    return (
      <Landing
        name={name}
        onNameChange={setName}
        onEnterVisitor={(gender) => void enterAsVisitor(gender)}
        onEnterSeller={() => void enterAsSeller()}
        sellerResumeSlot={savedSeller?.boothSlot ?? null}
        busy={busy}
        error={error}
      />
    );
  }

  /* ---------------------------- seller setup ----------------------------- */
  if (phase === "seller-setup") {
    return (
      <div className="relative flex min-h-screen w-full items-start justify-center overflow-hidden px-4 py-8">
        <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/farsha-market-hero.jpg')" }} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#050b11_0%,rgba(5,11,17,.85)_45%,rgba(5,11,17,.7)_100%)]" />
        <div className="relative z-10 w-full max-w-2xl">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase("landing");
            }}
            className="mb-4 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-bold text-slate-300 backdrop-blur hover:text-white"
          >
            ← رجوع
          </button>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-3">
              <FarshaMark size={38} className="text-amber-100" />
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold text-amber-200">
                <Icon name="seller" size={15} />بوابة أصحاب المحلات
              </span>
            </div>
            <h1 className="mt-5 text-2xl font-black text-white sm:text-3xl">محلك على واجهة فرشة</h1>
            <p className="mt-2 max-w-xl text-xs leading-7 text-slate-400">
              اختر واحدًا من 100 محل، ارفع صورة لافتتك، حدّد طراز الواجهة وأضف عروضك. ستقف أمام باب محلك فور الدخول، وكل تعديل تنشره يظهر للزوار مباشرة.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <SlotPicker
                selected={setupSlot}
                onSelect={(slot) => {
                  setSetupSlot(slot);
                  setError(null);
                }}
                onAuto={() => {
                  setSetupSlot(null);
                  setError(null);
                }}
              />

              <section className="rounded-3xl border border-white/10 bg-white/[.025] p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-extrabold text-white">من يمثّل محلك؟</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">سيقف هذا الشخص أمام محلك ويستقبل رسائل الزوار</p>
                </div>
                <GenderPicker value={repGender} onChange={setRepGender} disabled={busy} />
              </section>

              <BoothEditor
                mode="setup"
                session={{ id: "pending", secret: "pending" }}
                slot={setupSlot}
                avatarGender={repGender}
                busy={busy}
                onReady={(draft, products, slot) => {
                  void claimAndEnter(draft, products, slot);
                }}
              />

              {setupSlot === null ? (
                <p className="text-center text-[11px] text-slate-500">
                  لم تختر محلًا محددًا — سنحجز لك أول موقع متاح على الشارع.
                </p>
              ) : null}

              {error ? (
                <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------- world -------------------------------- */
  if (!session) return null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04060d]">
      <MarketCanvas
        key={session.id}
        session={session}
        startX={start.x}
        startY={start.y}
        targetSlot={targetSlot}
        onTargetChange={setTargetSlot}
        onOpenBooth={(slot) => setDetailSlot(slot)}
        onOpenPanel={() => setPanelOpen(true)}
        onRentSlot={(slot) => setRentSlot(slot)}
        onExpire={() => {
          setSession(null);
          setPhase("landing");
          setError("انقطع اتصالك بالسوق، أدخل مرة أخرى.");
        }}
      />

      {rentSlot !== null ? <RentDialog slot={rentSlot} onClose={() => setRentSlot(null)} /> : null}

      {detailSlot !== null ? (
        <BoothDetail
          slot={detailSlot}
          onNavigate={(slot) => {
            setTargetSlot(slot);
            setDetailSlot(null);
          }}
          onClose={() => setDetailSlot(null)}
        />
      ) : null}

      {panelOpen && session.boothSlot !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950/95 p-5 sm:rounded-3xl sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  <span className="flex items-center gap-2"><Icon name="seller" size={20} />إدارة المحل #{session.boothSlot}</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  كل تعديل يظهر للزوار داخل السوق مباشرة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                إغلاق ✕
              </button>
            </div>

            <BoothEditor
              mode="manage"
              session={session}
              slot={session.boothSlot}
              onBoothChange={(detail) => setSession((current) => current ? { ...current, gender: detail.avatarGender } : current)}
              onGoToBooth={(slot) => {
                setTargetSlot(slot);
                setPanelOpen(false);
              }}
              onReleased={() => {
                setPanelOpen(false);
                setSavedSeller(null);
                try { window.localStorage.removeItem(SELLER_STORAGE_KEY); } catch { /* no-op */ }
                setSession({ ...session, boothSlot: null, role: "visitor" });
              }}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
