"use client";

import { useEffect, useState } from "react";

export type TimerState = {
  remainingMs: number;
  totalMs: number;
  expired: boolean;
};

/**
 * 시험 타이머 · startTime + durationMinutes로 종료 시각 계산
 *
 * 신뢰성:
 * - 1초 setInterval + visibilitychange/focus/online 리스너
 *   → 백그라운드 tab throttle에서 돌아오면 즉시 Date.now() 재계산
 * - Date.now() 기반이므로 tick 지연이 있어도 화면 회복 즉시 정확값 표시
 * - 서버 백업(pg_cron)이 있으면 페이지가 닫혀 있어도 만료 세션 자동 제출됨
 */
export function useExamTimer(
  startTime: string | Date | null | undefined,
  durationMinutes: number
): TimerState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
    };
  }, []);

  const totalMs = durationMinutes * 60 * 1000;
  if (!startTime) {
    return { remainingMs: totalMs, totalMs, expired: false };
  }
  const startMs = new Date(startTime).getTime();
  const endsAt = startMs + totalMs;
  const remainingMs = Math.max(0, endsAt - now);
  return { remainingMs, totalMs, expired: remainingMs === 0 };
}

export function formatHms(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
