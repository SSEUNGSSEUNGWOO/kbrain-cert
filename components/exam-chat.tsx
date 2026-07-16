"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionMessage } from "@/lib/hooks/use-exam-session-live";
import { cn } from "@/lib/utils";

export function ExamChat({
  messages,
  unreadCount,
  isSubmitted,
  onOpen,
}: {
  messages: SessionMessage[];
  unreadCount: number;
  isSubmitted: boolean;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 감독관 공지가 오면 자동 open
  useEffect(() => {
    const hasNewAnnouncement = messages.some(
      (m) => m.is_announcement && m.sender_role === "examiner"
    );
    if (hasNewAnnouncement && unreadCount > 0) setOpen(true);
  }, [messages, unreadCount]);

  useEffect(() => {
    if (open) {
      onOpen();
      // 스크롤 맨 아래
      requestAnimationFrame(() => {
        if (bodyRef.current) {
          bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
      });
    }
  }, [open, messages, onOpen]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/exam/session/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) setInput("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-6 bottom-[210px] z-40">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="relative w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-white shadow-lg flex items-center justify-center text-xl transition"
        >
          💬
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-white animate-pulse font-tabular">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="w-80 rounded-md bg-white border border-border shadow-xl overflow-hidden flex flex-col max-h-[400px]">
          <div className="px-4 py-3 border-b border-border bg-primary text-white flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase opacity-80">
                Chat · 감독관 대화
              </div>
              <div className="text-xs font-bold">
                {messages.length}개 메시지
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-lg"
            >
              ×
            </button>
          </div>
          <div
            ref={bodyRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 bg-surface-soft/40 min-h-[160px]"
          >
            {messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">
                아직 메시지가 없습니다
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
          <form
            onSubmit={send}
            className="p-2 border-t border-border flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || isSubmitted}
              placeholder={
                isSubmitted ? "세션 종료 · 채팅 불가" : "감독관에게 문의…"
              }
              maxLength={500}
              className="flex-1 h-9 rounded-md border border-border bg-white px-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || isSubmitted || !input.trim()}
              className="h-9 px-3 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-40 transition"
            >
              전송
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: SessionMessage }) {
  if (message.sender_role === "system") {
    return (
      <div className="text-center">
        <span className="inline-block text-[10px] text-muted-foreground bg-white border border-border rounded-sm px-2 py-1 font-tabular">
          {message.content}
        </span>
      </div>
    );
  }
  const isSelf = message.sender_role === "applicant";
  return (
    <div className={cn("flex", isSelf ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-md px-3 py-2 text-sm",
          isSelf
            ? "bg-primary text-white"
            : message.is_announcement
            ? "bg-danger text-white"
            : "bg-white border border-border"
        )}
      >
        {message.is_announcement && !isSelf && (
          <div className="text-[9px] font-bold tracking-widest uppercase mb-0.5 opacity-80">
            📢 공지
          </div>
        )}
        <div className="break-words">{message.content}</div>
        <div
          className={cn(
            "text-[9px] font-tabular mt-1",
            isSelf ? "text-white/70" : "text-muted"
          )}
        >
          {isSelf ? "나" : "감독관"} ·{" "}
          {new Date(message.created_at).toLocaleTimeString("ko-KR")}
        </div>
      </div>
    </div>
  );
}
