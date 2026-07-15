"use client";

import { useEffect, useRef, useState } from "react";
import type { MonitorEvent } from "@/lib/hooks/use-monitor-events";
import { cn } from "@/lib/utils";

const FULLSCREEN_VIOLATION_LIMIT = 5;
const WINDOW_BLUR_THRESHOLD_MS = 3000;
const ENTRY_GRACE_MS = 30_000; // 진입 후 30초는 permission dialog로 인한 오탐 방지

/**
 * 시험창 CBT 감독 가드
 * - Fullscreen 강제 (자동 요청 · 이탈 감지 · N회 위반 시 자동 제출)
 * - 탭 이탈 (visibilitychange) · 즉시 이벤트
 * - 윈도우 blur 3초+ (조용한 alt-tab 감지)
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
  onForceSubmit,
}: {
  active: boolean;
  onEvent: (event: MonitorEvent) => void;
  onForceSubmit: () => void;
}) {
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [blackScreen, setBlackScreen] = useState(false);
  const enterAtRef = useRef<number>(Date.now());
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen 자동 요청 + 이탈 감지
  useEffect(() => {
    if (!active) return;
    enterAtRef.current = Date.now();
    const requestFs = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // 사용자 제스처 필요 · 클릭으로 재시도
      }
    };
    void requestFs();

    const onFsChange = () => {
      const inFs = !!document.fullscreenElement;
      if (!inFs) {
        const gracePeriod = Date.now() - enterAtRef.current < ENTRY_GRACE_MS;
        if (gracePeriod) return;
        setFullscreenExits((n) => {
          const next = n + 1;
          onEvent({
            eventType: "fullscreen_exit",
            severity: "high",
            payload: { count: next },
          });
          if (next >= FULLSCREEN_VIOLATION_LIMIT) {
            onForceSubmit();
          }
          return next;
        });
        setBlackScreen(true);
      } else {
        setBlackScreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [active, onEvent, onForceSubmit]);

  // 탭 이탈 · visibilitychange
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      const gracePeriod = Date.now() - enterAtRef.current < ENTRY_GRACE_MS;
      if (gracePeriod) return;
      if (document.hidden) {
        onEvent({ eventType: "tab_switch", severity: "high" });
        setBlackScreen(true);
      } else {
        setBlackScreen(false);
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
          severity: "warn",
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

  if (!active) return null;

  return (
    <>
      {/* 위반 카운터 배너 */}
      {fullscreenExits > 0 && (
        <div className="fixed top-20 right-6 z-40 rounded-md bg-danger text-white px-4 py-2.5 shadow-lg animate-pulse">
          <div className="text-[10px] font-bold tracking-widest uppercase mb-0.5">
            전체화면 이탈
          </div>
          <div className="text-sm font-bold font-tabular">
            {fullscreenExits} / {FULLSCREEN_VIOLATION_LIMIT} · 초과 시 강제 제출
          </div>
        </div>
      )}

      {/* 탭 이탈/Fullscreen 해제 시 검정 오버레이 */}
      {blackScreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={async () => {
            try {
              await document.documentElement.requestFullscreen();
              setBlackScreen(false);
            } catch {
              /* ignore */
            }
          }}
        >
          <div className="max-w-md text-center p-8 rounded-md border-2 border-danger bg-black">
            <div className="w-14 h-14 mx-auto rounded-full bg-danger text-white flex items-center justify-center text-2xl font-bold mb-4">
              !
            </div>
            <div className="text-danger font-bold text-lg mb-2">
              시험 화면 이탈 감지
            </div>
            <div className="text-sm text-white/80 leading-relaxed mb-4">
              전체화면에서 벗어났거나 다른 앱으로 전환하셨습니다. 이 행위는 감독관에게 기록됩니다.
            </div>
            <button className={cn(
              "h-11 px-6 rounded-md bg-white text-black font-bold text-sm hover:bg-white/90 transition"
            )}>
              화면 클릭 · 시험 창으로 복귀
            </button>
          </div>
        </div>
      )}
    </>
  );
}
