"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RESYNC_INTERVAL_MS = 5 * 60 * 1000;
const SAMPLE_COUNT = 3;

type ClockAnchor = {
  serverMs: number;
  performanceMs: number;
};

export function useServerClock(enabled = true): {
  nowMs: number | null;
  synchronized: boolean;
} {
  const anchorRef = useRef<ClockAnchor | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const synchronize = useCallback(async () => {
    if (!enabled) return;
    let best:
      | { roundTripMs: number; serverMs: number; receivedPerformanceMs: number }
      | undefined;

    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const startedPerformanceMs = performance.now();
      try {
        const response = await fetch(`/api/time?sample=${index}`, {
          cache: "no-store",
        });
        const receivedPerformanceMs = performance.now();
        if (!response.ok) continue;
        const data = (await response.json()) as { nowMs?: number };
        if (typeof data.nowMs !== "number") continue;
        const roundTripMs = receivedPerformanceMs - startedPerformanceMs;
        if (!best || roundTripMs < best.roundTripMs) {
          best = {
            roundTripMs,
            serverMs: data.nowMs,
            receivedPerformanceMs,
          };
        }
      } catch {
        // 다른 표본 또는 다음 재동기화에서 재시도
      }
    }

    if (!best) return;
    const anchor = {
      serverMs: best.serverMs + best.roundTripMs / 2,
      performanceMs: best.receivedPerformanceMs,
    };
    anchorRef.current = anchor;
    setNowMs(anchor.serverMs);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      anchorRef.current = null;
      return;
    }

    const initialSyncId = window.setTimeout(() => void synchronize(), 0);
    const tick = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setNowMs(
        anchor.serverMs + (performance.now() - anchor.performanceMs)
      );
    };
    const tickId = window.setInterval(tick, 1000);
    const syncId = window.setInterval(
      () => void synchronize(),
      RESYNC_INTERVAL_MS
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        void synchronize();
      }
    };
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tickId);
      window.clearInterval(syncId);
      window.clearTimeout(initialSyncId);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, synchronize]);

  return { nowMs, synchronized: nowMs != null };
}
