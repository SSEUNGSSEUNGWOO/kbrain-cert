"use client";

import { useCallback, useEffect, useRef } from "react";

export type MonitorEvent = {
  eventType: string;
  severity?: "info" | "warn" | "high";
  questionIndex?: number | null;
  payload?: Record<string, unknown>;
};

const BATCH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;

/**
 * 감독 이벤트 batch 저장 훅
 * sessionId null이면 (Practice) no-op · fire()만 리턴
 * fire()로 이벤트 쌓고 · 5초마다 or 50개 도달 시 POST
 * unmount / beforeunload 시 남은 이벤트 flush (navigator.sendBeacon)
 */
export function useMonitorEvents(sessionId: string | null | undefined) {
  const queueRef = useRef<MonitorEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(
    async (useBeacon = false) => {
      if (!sessionId || queueRef.current.length === 0) return;
      const events = queueRef.current.splice(0, queueRef.current.length);
      const body = JSON.stringify({ sessionId, events });
      try {
        if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/exam/monitoring",
            new Blob([body], { type: "application/json" })
          );
        } else {
          await fetch("/api/exam/monitoring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          });
        }
      } catch (err) {
        console.warn("[monitor] flush failed", err);
        // 실패 시 다음 tick에서 재시도 (queue 앞에 되돌리기)
        queueRef.current.unshift(...events);
      }
    },
    [sessionId]
  );

  const fire = useCallback(
    (event: MonitorEvent) => {
      if (!sessionId) return;
      queueRef.current.push(event);
      if (queueRef.current.length >= MAX_BATCH) {
        void flush();
      }
    },
    [sessionId, flush]
  );

  useEffect(() => {
    if (!sessionId) return;
    intervalRef.current = setInterval(() => void flush(), BATCH_INTERVAL_MS);
    const onBeforeUnload = () => void flush(true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush(true);
    };
  }, [sessionId, flush]);

  return { fire, flush };
}
