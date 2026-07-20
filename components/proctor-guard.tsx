"use client";

import { useEffect, useRef } from "react";
import type { MonitorEvent } from "@/lib/hooks/use-monitor-events";

const WINDOW_BLUR_THRESHOLD_MS = 3000;
const ENTRY_GRACE_MS = 30_000; // 진입 후 30초는 permission dialog로 인한 오탐 방지

/**
 * 시험창 CBT 감독 가드
 * - 탭 이탈·윈도우 blur 기록 (작업형 외부 도구 사용을 고려해 info)
 * - 복사·붙여넣기·잘라내기 차단 (input/textarea 제외)
 * - 우클릭 · 드래그·드롭 차단
 * - 키보드 단축키 차단 (F12, Ctrl+Shift+I/C/P/S, Ctrl+P/S/U, PrintScreen, Cmd+Shift+3/4/5)
 * - 인쇄 방지 (beforeprint)
 * - 페이지 벗어남 방지 (beforeunload)
 *
 * 모든 위반은 onEvent 콜백으로 상위에 전달 (부모가 monitoring_events 저장)
 */
export function ProctorGuard({
  active,
  onEvent,
}: {
  active: boolean;
  onEvent: (event: MonitorEvent) => void;
}) {
  const enterAtRef = useRef<number>(0);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    enterAtRef.current = Date.now();
  }, [active]);

  // 탭 이탈 · visibilitychange
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      const gracePeriod = Date.now() - enterAtRef.current < ENTRY_GRACE_MS;
      if (gracePeriod) return;
      if (document.hidden) {
        onEvent({ eventType: "tab_switch", severity: "info" });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, onEvent]);

  // 윈도우 blur 3초+ (조용한 alt-tab)
  useEffect(() => {
    if (!active) return;
    const onBlur = () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      blurTimerRef.current = setTimeout(() => {
        const gracePeriod = Date.now() - enterAtRef.current < ENTRY_GRACE_MS;
        if (gracePeriod) return;
        onEvent({
          eventType: "window_blur",
          severity: "info",
          payload: { thresholdMs: WINDOW_BLUR_THRESHOLD_MS },
        });
      }, WINDOW_BLUR_THRESHOLD_MS);
    };
    const onFocus = () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, [active, onEvent]);

  // 복사·붙여넣기·잘라내기 차단 (input/textarea/contenteditable 제외)
  useEffect(() => {
    if (!active) return;
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      e.preventDefault();
      onEvent({ eventType: "copy_blocked", severity: "warn" });
    };
    const onCut = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      e.preventDefault();
      onEvent({ eventType: "copy_blocked", severity: "warn", payload: { type: "cut" } });
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
    };
  }, [active, onEvent]);

  // 우클릭 · 드래그·드롭 차단
  useEffect(() => {
    if (!active) return;
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      onEvent({ eventType: "context_menu_blocked", severity: "info" });
    };
    const onDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("dragstart", onDrag);
    document.addEventListener("drop", onDrag);
    return () => {
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("dragstart", onDrag);
      document.removeEventListener("drop", onDrag);
    };
  }, [active, onEvent]);

  // 키보드 단축키 · PrintScreen · F12 · Ctrl+Shift+I/C/P/S · Ctrl+P/S/U · macOS Cmd+Shift+3/4/5
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // F12
      if (key === "F12") {
        e.preventDefault();
        onEvent({ eventType: "devtools_attempt", severity: "warn", payload: { key: "F12" } });
        return;
      }
      // PrintScreen (Win) or Cmd+Shift+3/4/5 (macOS 스크린샷)
      if (key === "PrintScreen" || (e.metaKey && shift && ["3", "4", "5"].includes(key))) {
        e.preventDefault();
        onEvent({
          eventType: "screenshot_attempt",
          severity: "high",
          payload: { key },
        });
        return;
      }
      // Ctrl+Shift+I/C/P/S (DevTools · 뷰소스 등)
      if (ctrl && shift && ["I", "C", "P", "S", "J"].includes(key.toUpperCase())) {
        e.preventDefault();
        onEvent({
          eventType: "devtools_attempt",
          severity: "warn",
          payload: { combo: `${e.metaKey ? "Cmd+" : "Ctrl+"}Shift+${key}` },
        });
        return;
      }
      // Ctrl+P (인쇄) · Ctrl+S (저장) · Ctrl+U (뷰소스)
      if (ctrl && !shift && ["p", "s", "u"].includes(key.toLowerCase())) {
        e.preventDefault();
        onEvent({
          eventType: "shortcut_blocked",
          severity: "warn",
          payload: { combo: `${e.metaKey ? "Cmd+" : "Ctrl+"}${key.toUpperCase()}` },
        });
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, onEvent]);

  // 인쇄 방지
  useEffect(() => {
    if (!active) return;
    const onPrint = () => {
      onEvent({ eventType: "print_attempt", severity: "warn" });
    };
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, [active, onEvent]);

  // 페이지 벗어남 방지 (beforeunload)
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "시험 중입니다. 정말로 나가시겠습니까?";
      onEvent({ eventType: "navigation_attempt", severity: "warn" });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, onEvent]);

  return null;
}
