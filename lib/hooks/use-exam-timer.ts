"use client";

import { useEffect, useState } from "react";

export type TimerState = {
  remainingMs: number;
  totalMs: number;
  expired: boolean;
};

/**
 * 시험 타이머 · startTime + durationMinutes로 종료 시각 계산 · 1초마다 갱신
 * 만료 감지는 부모에서 timer.expired를 useEffect로 관찰
 */
export function useExamTimer(
  startTime: string | Date | null | undefined,
  durationMinutes: number
): TimerState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
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
