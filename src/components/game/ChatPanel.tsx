"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/ui/Icon";
import { MAX_CHAT_LENGTH } from "@/lib/game/constants";
import { apiChat, type ClientSession } from "@/lib/game/client";
import type { ChatMessage, ChatThread, Gender } from "@/lib/game/types";

const ERRORS: Record<string, string> = {
  too_fast: "أرسلت رسائل كثيرة بسرعة، انتظر قليلًا.",
  own_booth: "هذا محلك.",
  free_slot: "هذا المحل لم يعد متاحًا للمحادثة.",
  unauthorized: "انتهت الجلسة، أعد الدخول.",
  network: "تعذّر الاتصال، حاول مرة أخرى.",
};

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

export type ChatPanelProps = {
  mode: "visitor" | "seller";
  session: ClientSession;
  slot: number;
  brand: string;
  online: boolean;
  gender: Gender;
  onClose: () => void;
};

/**
 * Chat box that floats above the shop's representative.
 * Visitors talk to the seller; the seller sees every visitor thread and replies.
 */
export default function ChatPanel({ mode, session, slot, brand, online, gender, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const failure = (code?: string) => setError(code ? (ERRORS[code] ?? "تعذّر تنفيذ الطلب.") : null);

  const loadVisitor = useCallback(async () => {
    const result = await apiChat("list", session, { slot });
    if (result.messages) setMessages(result.messages);
    else if (result.error && result.error !== "network") failure(result.error);
  }, [session, slot]);

  const loadThreads = useCallback(async () => {
    const result = await apiChat("threads", session);
    if (result.threads) setThreads(result.threads);
  }, [session]);

  const loadThread = useCallback(async (visitorId: string) => {
    const result = await apiChat("thread", session, { visitorId });
    if (result.messages) setMessages(result.messages);
  }, [session]);

  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (stopped || document.hidden) return;
      if (mode === "visitor") void loadVisitor();
      else if (activeThread) void loadThread(activeThread.visitorId);
      else void loadThreads();
    };
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [mode, activeThread, loadVisitor, loadThread, loadThreads]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, activeThread]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    failure();
    const result = mode === "visitor"
      ? await apiChat("send", session, { slot, text: value })
      : activeThread
        ? await apiChat("reply", session, { visitorId: activeThread.visitorId, text: value })
        : { error: "network" };
    setSending(false);
    if (result.error) { failure(result.error); return; }
    setText("");
    stickRef.current = true;
    if (result.messages) setMessages(result.messages);
  };

  const showThreads = mode === "seller" && !activeThread;
  const title = mode === "seller"
    ? activeThread ? activeThread.visitorName : "رسائل الزوار"
    : brand;

  return (
    <div className="flex max-h-[min(70vh,460px)] w-full flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#081426]/97 shadow-[0_24px_70px_rgba(0,0,0,.6)] backdrop-blur-xl" dir="rtl">
      <header className="flex items-center gap-2.5 border-b border-white/10 bg-white/[.03] px-3.5 py-3">
        {mode === "seller" && activeThread ? (
          <button type="button" onClick={() => { setActiveThread(null); setMessages([]); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10" aria-label="رجوع"><Icon name="back" size={16} className="rotate-180" /></button>
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-300/15 text-teal-200"><Icon name={gender} size={22} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{title}</p>
          {mode === "visitor" ? (
            <p className={`flex items-center gap-1.5 text-[10px] ${online ? "text-emerald-300" : "text-slate-500"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`} />
              {online ? "متصل الآن" : "غير متصل · سيرى رسالتك لاحقًا"}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10" aria-label="إغلاق"><Icon name="close" size={16} /></button>
      </header>

      {showThreads ? (
        <div className="min-h-[150px] flex-1 overflow-y-auto p-2.5">
          {threads.length === 0 ? (
            <p className="px-3 py-10 text-center text-xs leading-6 text-slate-500">لا توجد رسائل بعد. عندما يكتب لك زائر ستظهر محادثته هنا.</p>
          ) : threads.map((thread) => (
            <button key={thread.visitorId} type="button" onClick={() => { stickRef.current = true; setMessages([]); setActiveThread(thread); }} className="mb-1.5 flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-3 text-right transition hover:bg-white/[.07]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-slate-300"><Icon name="visitor" size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><b className="truncate text-xs text-white">{thread.visitorName}</b><span className="shrink-0 text-[9px] text-slate-600">{timeOf(thread.lastAt)}</span></span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{thread.lastText}</span>
              </span>
              {thread.unread > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{thread.unread}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
            className="flex min-h-[150px] flex-1 flex-col gap-2 overflow-y-auto p-3"
          >
            {messages.length === 0 && mode === "visitor" ? (
              <p className="self-start rounded-2xl rounded-tr-md bg-white/[.07] px-3 py-2 text-xs leading-6 text-slate-200">أهلًا بك في {brand}! اكتب رسالتك وسأرد عليك بأقرب وقت.</p>
            ) : null}
            {messages.map((message) => {
              const mine = message.sender === mode;
              return (
                <div key={message.id} className={`max-w-[85%] ${mine ? "self-start" : "self-end"}`}>
                  <p className={`break-words rounded-2xl px-3 py-2 text-xs leading-6 ${mine ? "rounded-tr-md bg-teal-300 text-teal-950" : "rounded-tl-md bg-white/[.09] text-slate-100"}`}>{message.text}</p>
                  <span className={`mt-0.5 block text-[9px] text-slate-600 ${mine ? "text-right" : "text-left"}`}>{timeOf(message.at)}</span>
                </div>
              );
            })}
          </div>

          {error ? <p className="mx-3 mb-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-1.5 text-[11px] text-rose-200">{error}</p> : null}
          <form onSubmit={(event) => void submit(event)} className="flex items-center gap-2 border-t border-white/10 p-2.5">
            <input
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_CHAT_LENGTH))}
              placeholder={mode === "seller" ? "اكتب ردك…" : "اكتب رسالة للبائع…"}
              className="input flex-1 text-xs"
              autoComplete="off"
            />
            <button type="submit" disabled={sending || !text.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-300 text-teal-950 transition hover:bg-teal-200 disabled:opacity-40" aria-label="إرسال"><Icon name="send" size={17} className="-scale-x-100" /></button>
          </form>
        </>
      )}
    </div>
  );
}
