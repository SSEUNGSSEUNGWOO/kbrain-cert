"use client";

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saved" | "error";

const DEBOUNCE_MS = 1500;

/**
 * 답안 auto-save
 * sessionId가 없으면 (Practice) no-op · 값 변경 감지만 하고 저장 skip
 * 값 변경 후 DEBOUNCE_MS 뒤에 POST /api/exam/answers/save
 */
export function useAutoSaveAnswer(
  sessionId: string | null | undefined,
  questionId: string | undefined,
  slotValues: Record<string, unknown>
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");

  useEffect(() => {
    if (!sessionId || !questionId) return;

    const payload = JSON.stringify(slotValues);
    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("pending");

    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/exam/answers/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, questionId, slotValues }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus("saved");
        setLastSavedAt(new Date());
      } catch (err) {
        console.warn("[auto-save] failed", err);
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [sessionId, questionId, slotValues]);

  return { status, lastSavedAt };
}
