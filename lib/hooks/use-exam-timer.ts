"use client";

import { useServerClock } from "@/lib/hooks/use-server-clock";

export type TimerState = {
  remainingMs: number;
  totalMs: number;
  expired: boolean;
  synchronized: boolean;
};

/**
 * 시험 타이머 · startTime + durationMinutes로 종료 시각 계산
 *
 * 신뢰성:
 * - 서버 시각을 3회 측정해 RTT가 가장 짧은 표본으로 동기화
 * - 동기화 후 performance.now()로 경과 시간을 계산해 OS 시각 변경과 무관
 * - 서버 백업(pg_cron)이 있으면 페이지가 닫혀 있어도 만료 세션 자동 제출됨
 */
export function useExamTimer(
  startTime: string | Date | null | undefined,
  durationMinutes: number
): TimerState {
  const totalMs = durationMinutes * 60 * 1000;
  const { nowMs, synchronized } = useServerClock(!!startTime);
  if (!startTime || nowMs == null) {
    return {
      remainingMs: totalMs,
      totalMs,
      expired: false,
      synchronized: !startTime,
    };
  }
  const startMs = new Date(startTime).getTime();
  const endsAt = startMs + totalMs;
  const remainingMs = Math.max(0, endsAt - nowMs);
  return { remainingMs, totalMs, expired: remainingMs === 0, synchronized };
}

export function formatHms(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
