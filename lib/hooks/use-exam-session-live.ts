"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientSupabase } from "@/lib/supabase/client";

export type SessionMessage = {
  id: number;
  sender_role: "applicant" | "examiner" | "system";
  content: string;
  is_announcement: boolean;
  created_at: string;
  read_at: string | null;
};

export type SessionLive = {
  timeExtensionMinutes: number;
  isSubmitted: boolean;
  messages: SessionMessage[];
  unreadCount: number;
};

/**
 * 응시자용 세션 라이브 상태 훅 · sessionId 없으면 no-op (Practice)
 * - time_extension_minutes 실시간 조회
 * - 세션 강제 종료(status='submitted') 감지
 * - session_messages 실시간 구독
 * - 안 읽은 감독관 메시지 카운트
 */
export function useExamSessionLive(sessionId: string | null | undefined): {
  live: SessionLive;
  markRead: () => void;
  addMessage: (message: SessionMessage) => void;
} {
  const [live, setLive] = useState<SessionLive>({
    timeExtensionMinutes: 0,
    isSubmitted: false,
    messages: [],
    unreadCount: 0,
  });
  const lastReadIdRef = useRef(0);

  const addMessage = useCallback((message: SessionMessage) => {
    setLive((current) => {
      if (current.messages.some((item) => item.id === message.id)) return current;
      return {
        ...current,
        messages: [...current.messages, message].sort((a, b) => a.id - b.id),
        unreadCount:
          current.unreadCount +
          (message.sender_role !== "applicant" &&
          message.id > lastReadIdRef.current
            ? 1
            : 0),
      };
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [msgRes, sesRes] = await Promise.all([
          fetch(`/api/exam/session/messages?t=${Date.now()}`, {
            cache: "no-store",
          }),
          fetch(`/api/exam/session/state?t=${Date.now()}`, {
            cache: "no-store",
          }),
        ]);
        if (cancelled) return;
        const msgData = msgRes.ok ? await msgRes.json() : { messages: [] };
        const sesData = sesRes.ok
          ? await sesRes.json()
          : { timeExtensionMinutes: 0, isSubmitted: false };
        setLive((prev) => {
          const msgs: SessionMessage[] = msgData.messages ?? [];
          const unread = msgs.filter(
            (m) => m.sender_role !== "applicant" && m.id > lastReadIdRef.current
          ).length;
          return {
            timeExtensionMinutes: sesData.timeExtensionMinutes ?? 0,
            isSubmitted: !!sesData.isSubmitted,
            messages: msgs,
            unreadCount: unread,
          };
        });
      } catch {
        /* ignore */
      }
    };

    void fetchAll();
    const polling = setInterval(fetchAll, 15_000);

    const supabase = createClientSupabase();
    const channel = supabase
      .channel(`applicant-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => addMessage(payload.new as SessionMessage)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => void fetchAll()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [addMessage, sessionId]);

  const markRead = useCallback(() => {
    lastReadIdRef.current =
      live.messages.length > 0
        ? Math.max(...live.messages.map((m) => m.id))
        : 0;
    setLive((prev) => ({ ...prev, unreadCount: 0 }));
  }, [live.messages]);

  return { live, markRead, addMessage };
}
