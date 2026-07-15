"use client";

import { useCallback } from "react";

export type PrecheckStep = "env" | "pledge" | "waiting";

export type EnvResultSnapshot = {
  monitor: { status: string; detail: string };
  webcam: { status: string; detail: string };
  screen: { status: string; detail: string };
  network: { status: string; detail: string };
  cpu: { status: string; detail: string };
  browser: { status: string; detail: string };
};

/**
 * 실 시험 응시자용 사전 점검 저장 훅
 * sessionId가 없으면 (Practice 등) no-op · 조용히 성공 처리
 * 실패해도 UI 흐름은 막지 않음 (로그만 남김)
 */
export function useSavePrecheck(sessionId: string | null | undefined) {
  return useCallback(
    async (step: PrecheckStep, data?: Record<string, unknown>) => {
      if (!sessionId) return { ok: true, skipped: true };
      try {
        const res = await fetch("/api/precheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, step, data }),
        });
        if (!res.ok) {
          console.warn("[precheck] save failed", step, await res.text());
          return { ok: false };
        }
        return { ok: true };
      } catch (err) {
        console.warn("[precheck] save error", step, err);
        return { ok: false };
      }
    },
    [sessionId]
  );
}
