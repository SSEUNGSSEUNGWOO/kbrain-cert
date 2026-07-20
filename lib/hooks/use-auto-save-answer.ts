"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saved" | "error";

const DEBOUNCE_MS = 1500;
const RETRY_DELAYS_MS = [0, 500, 1500];

type AnswerValues = Record<string, unknown>;
type AnswersByQuestion = Record<string, AnswerValues>;

/**
 * 답안 auto-save
 * - 입력 정지 1.5초 후 저장
 * - 문항 이동 시 대기 중 저장을 완료한 뒤 이동
 * - 최종 제출 전 전체 로컬 답안을 한 번의 요청으로 확정 저장
 * - 일시적 실패는 최대 3회 재시도
 */
export function useAutoSaveAnswer(
  sessionId: string | null | undefined,
  questionId: string | undefined,
  slotValues: AnswerValues
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestRef = useRef({ questionId, slotValues });
  const savedPayloadsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    latestRef.current = { questionId, slotValues };
  }, [questionId, slotValues]);

  const postWithRetry = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      if (!sessionId) return true;

      for (const delay of RETRY_DELAYS_MS) {
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        try {
          const response = await fetch("/api/exam/answers/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, ...body }),
            keepalive: true,
          });
          if (response.ok) return true;
          if (
            response.status >= 400 &&
            response.status < 500 &&
            ![408, 425, 429].includes(response.status)
          ) {
            return false;
          }
        } catch {
          // 다음 재시도에서 처리
        }
      }
      return false;
    },
    [sessionId]
  );

  const enqueueSave = useCallback(
    (
      targetQuestionId: string,
      targetValues: AnswerValues
    ): Promise<boolean> => {
      const payload = JSON.stringify(targetValues);
      if (savedPayloadsRef.current.get(targetQuestionId) === payload) {
        return requestChainRef.current;
      }

      setStatus("pending");
      const next = requestChainRef.current.then(async () => {
        const ok = await postWithRetry({
          questionId: targetQuestionId,
          slotValues: targetValues,
        });
        if (ok) {
          savedPayloadsRef.current.set(targetQuestionId, payload);
          setStatus("saved");
          setLastSavedAt(new Date());
        } else {
          setStatus("error");
        }
        return ok;
      });
      requestChainRef.current = next.catch(() => false);
      return next;
    },
    [postWithRetry]
  );

  const flushCurrent = useCallback(async (): Promise<boolean> => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const latest = latestRef.current;
    if (!sessionId || !latest.questionId) {
      return requestChainRef.current;
    }
    return enqueueSave(latest.questionId, latest.slotValues);
  }, [enqueueSave, sessionId]);

  const saveAll = useCallback(
    async (answers: AnswersByQuestion): Promise<boolean> => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!sessionId) return true;

      await requestChainRef.current;

      setStatus("pending");
      const rows = Object.entries(answers).map(
        ([targetQuestionId, targetValues]) => ({
          questionId: targetQuestionId,
          slotValues: targetValues,
        })
      );
      const ok = await postWithRetry({ answers: rows });
      if (ok) {
        for (const [targetQuestionId, targetValues] of Object.entries(answers)) {
          savedPayloadsRef.current.set(
            targetQuestionId,
            JSON.stringify(targetValues)
          );
        }
        setStatus("saved");
        setLastSavedAt(new Date());
      } else {
        setStatus("error");
      }
      return ok;
    },
    [postWithRetry, sessionId]
  );

  useEffect(() => {
    if (!sessionId || !questionId) return;
    const payload = JSON.stringify(slotValues);
    if (savedPayloadsRef.current.get(questionId) === payload) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("pending");
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      void enqueueSave(questionId, slotValues);
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enqueueSave, questionId, sessionId, slotValues]);

  useEffect(() => {
    if (!sessionId) return;
    const flushWhenLeaving = () => {
      void flushCurrent();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        void flushCurrent();
      }
    };
    window.addEventListener("pagehide", flushWhenLeaving);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushWhenLeaving);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushCurrent, sessionId]);

  return { status, lastSavedAt, flushCurrent, saveAll };
}
