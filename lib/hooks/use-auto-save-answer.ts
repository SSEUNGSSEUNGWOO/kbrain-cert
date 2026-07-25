"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueueAnswer,
  listQueue,
  removeFromQueue,
} from "@/lib/offline-queue";

export type SaveStatus = "idle" | "pending" | "saved" | "error";

const DEBOUNCE_MS = 1500;
// 지수 백오프 + jitter · 100명 동시 응시 시 서버 폭탄 방지
// 첫 시도는 즉시 · 실패 시 500ms → 2000ms → 8000ms (각각 ±25% jitter)
const RETRY_BASE_DELAYS_MS = [0, 500, 2000, 8000];
const jitter = (base: number) =>
  base === 0 ? 0 : base + (Math.random() - 0.5) * base * 0.5;

type AnswerValues = Record<string, unknown>;
/**
 * 답안 auto-save
 * - 입력 정지 1.5초 후 저장
 * - 문항 이동 시 대기 중 저장을 완료한 뒤 이동
 * - 최종 제출 전 진행 중인 auto-save가 끝날 때까지 대기
 * - 일시적 실패는 최대 3회 재시도
 */
export function useAutoSaveAnswer(
  sessionId: string | null | undefined,
  questionId: string | undefined,
  slotValues: AnswerValues
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestRef = useRef({ questionId, slotValues });
  const savedPayloadsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    latestRef.current = { questionId, slotValues };
  }, [questionId, slotValues]);

  const postWithRetry = useCallback(
    async (body: {
      questionId: string;
      slotValues: AnswerValues;
    }): Promise<boolean> => {
      if (!sessionId) return true;

      for (const baseDelay of RETRY_BASE_DELAYS_MS) {
        const delay = jitter(baseDelay);
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
      // 모든 재시도 실패 · IndexedDB 오프라인 큐에 백업 (재연결 시 자동 flush)
      await enqueueAnswer({
        sessionId,
        questionId: body.questionId,
        slotValues: body.slotValues,
        savedAt: Date.now(),
      });
      return false;
    },
    [sessionId]
  );

  // 큐 flush · 재연결·mount·저장 성공 후 호출
  const flushOfflineQueue = useCallback(async () => {
    if (!sessionId) return;
    const items = await listQueue(sessionId);
    setQueuedCount(items.length);
    for (const item of items) {
      // 각 항목을 순차적으로 재시도 · 성공한 것만 제거
      try {
        const response = await fetch("/api/exam/answers/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: item.sessionId,
            questionId: item.questionId,
            slotValues: item.slotValues,
          }),
        });
        if (response.ok) {
          await removeFromQueue(item.id);
        }
      } catch {
        // 아직도 오프라인 · 다음 재연결 때 다시 시도
        break;
      }
    }
    // flush 후 잔여 개수 재계산
    const remaining = await listQueue(sessionId);
    setQueuedCount(remaining.length);
  }, [sessionId]);

  // 오프라인 상태에서 enqueue 될 때마다 queued count 재계산
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const tick = async () => {
      const items = await listQueue(sessionId);
      if (!cancelled) setQueuedCount(items.length);
    };
    void tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId]);

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

  const prepareSubmit = useCallback(async (): Promise<void> => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await requestChainRef.current;
    // 제출 전 오프라인 큐도 완전히 flush · 큐에 남은 답안이 서버에 반영되도록
    await flushOfflineQueue();
  }, [flushOfflineQueue]);

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

  // 오프라인 큐 flush · mount 시 1회 + 재연결 이벤트 (online)
  useEffect(() => {
    if (!sessionId) return;
    const initialId = window.setTimeout(() => void flushOfflineQueue(), 0);
    const onOnline = () => void flushOfflineQueue();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(initialId);
      window.removeEventListener("online", onOnline);
    };
  }, [flushOfflineQueue, sessionId]);

  return { status, lastSavedAt, queuedCount, flushCurrent, prepareSubmit };
}
