"use client";

import { useEffect, useState } from "react";
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
} {
  const [live, setLive] = useState<SessionLive>({
    timeExtensionMinutes: 0,
    isSubmitted: false,
    messages: [],
    unreadCount: 0,
  });
  const [lastReadId, setLastReadId] = useState<number>(0);

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
            (m) => m.sender_role !== "applicant" && m.id > lastReadId
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
        () => void fetchAll()
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
  }, [sessionId, lastReadId]);

  const markRead = () => {
    setLastReadId(
      live.messages.length > 0
        ? Math.max(...live.messages.map((m) => m.id))
        : 0
    );
    setLive((prev) => ({ ...prev, unreadCount: 0 }));
  };

  return { live, markRead };
}
