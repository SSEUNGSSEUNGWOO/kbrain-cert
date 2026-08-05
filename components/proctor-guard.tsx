"use client";

import { useEffect } from "react";
import type { MonitorEvent } from "@/lib/hooks/use-monitor-events";

/**
 * 시험창 CBT 감독 가드
 * - 복사·붙여넣기·잘라내기 차단 (input/textarea 제외)
 * - 우클릭 · 드래그·드롭 차단
 * - 키보드 단축키 차단 (F12, Ctrl+Shift+I/C/P/S, Ctrl+P/S/U, PrintScreen, Cmd+Shift+3/4/5)
 * - 인쇄 방지 (beforeprint)
 * - 페이지 벗어남 방지 (beforeunload)
 *
 * allowUnloadRef.current=true 면 beforeunload 트랩을 통과시킨다.
 * 제출 완료 등 의도된 페이지 이동 직전에 부모가 동기적으로 세팅 —
 * 그렇지 않으면 브라우저 이탈 확인 대화상자가 이동을 가로챈다.
 *
 * 모든 위반은 onEvent 콜백으로 상위에 전달 (부모가 monitoring_events 저장)
 */
export function ProctorGuard({
  active,
  onEvent,
  allowUnloadRef,
}: {
  active: boolean;
  onEvent: (event: MonitorEvent) => void;
  allowUnloadRef?: { current: boolean };
}) {
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
    // PrintScreen 은 preventDefault 로 캡쳐 자체를 못 막으므로 클립보드를 즉시 비워 무력화
    const clearClipboard = () => {
      try {
        void navigator.clipboard?.writeText("").catch(() => {});
      } catch {
        // clipboard 권한 거부 시 무시 (이벤트 기록은 별도로 남음)
      }
    };
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
        clearClipboard();
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
    // Windows 는 keyup 시점에 클립보드로 복사되므로 keyup 에서도 한 번 더 비움
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") clearClipboard();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
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
      if (allowUnloadRef?.current) return;
      e.preventDefault();
      e.returnValue = "시험 중입니다. 정말로 나가시겠습니까?";
      onEvent({ eventType: "navigation_attempt", severity: "warn" });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, onEvent, allowUnloadRef]);

  // 탭 hidden/visible 감지 · 다른 프로그램/탭으로 이탈
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      onEvent({
        eventType:
          document.visibilityState === "hidden" ? "tab_hidden" : "tab_visible",
        severity: document.visibilityState === "hidden" ? "warn" : "info",
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [active, onEvent]);

  // 창 focus 잃음 · 다른 앱으로 alt-tab
  useEffect(() => {
    if (!active) return;
    const onBlur = () => onEvent({ eventType: "window_blur", severity: "warn" });
    const onFocus = () => onEvent({ eventType: "window_focus", severity: "info" });
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, onEvent]);

  // 네트워크 상태 감지 · 오프라인/온라인
  useEffect(() => {
    if (!active) return;
    const onOffline = () =>
      onEvent({ eventType: "network_offline", severity: "high" });
    const onOnline = () =>
      onEvent({ eventType: "network_online", severity: "info" });
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [active, onEvent]);

  // 페이지 실제 unload · 브라우저 강제 종료 · 크래시 감지 (severity high · sendBeacon 발송)
  useEffect(() => {
    if (!active) return;
    const onPageHide = () => {
      onEvent({ eventType: "page_unloaded", severity: "high" });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [active, onEvent]);

  return null;
}
