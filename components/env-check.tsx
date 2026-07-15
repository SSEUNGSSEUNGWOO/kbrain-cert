"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CheckStatus = "pending" | "ok" | "warn" | "error";

type CheckResult = {
  status: CheckStatus;
  detail: string;
};

/**
 * 응시 환경 체크 · Practice 페이지에서 실전 전 확인용
 * - 웹캠: getUserMedia · 프리뷰
 * - 화면공유: getDisplayMedia · 사용자 클릭 필요
 * - 브라우저: navigator + fullscreen 지원 여부
 * - 네트워크: fetch로 응답 시간 측정
 *
 * onEnterExam 콜백이 있으면 통과 시 CTA 버튼 표시
 */
export function EnvCheck({ onEnterExam }: { onEnterExam?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [browserInfo, setBrowserInfo] = useState<CheckResult>({
    status: "pending",
    detail: "확인 중…",
  });
  const [webcam, setWebcam] = useState<CheckResult>({
    status: "pending",
    detail: "권한 요청 대기",
  });
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<CheckResult>({
    status: "pending",
    detail: "테스트 버튼 클릭",
  });
  const [network, setNetwork] = useState<CheckResult>({
    status: "pending",
    detail: "측정 중…",
  });
  const [fullscreen, setFullscreen] = useState<CheckResult>({
    status: "pending",
    detail: "확인 중…",
  });
  const [monitor, setMonitor] = useState<CheckResult>({
    status: "pending",
    detail: "감지 시작 버튼 클릭",
  });

  // 브라우저 정보 · Fullscreen 지원
  useEffect(() => {
    const ua = navigator.userAgent;
    const browser = /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
      ? "Firefox"
      : /Safari/.test(ua)
      ? "Safari"
      : /Edge/.test(ua)
      ? "Edge"
      : "Unknown";
    const supported = ["Chrome", "Edge", "Firefox"].includes(browser);
    setBrowserInfo({
      status: supported ? "ok" : "warn",
      detail: `${browser} · ${supported ? "지원 브라우저" : "권장 X (Chrome/Edge 사용 권장)"}`,
    });

    const fsSupported =
      document.documentElement.requestFullscreen != null &&
      document.exitFullscreen != null;
    setFullscreen({
      status: fsSupported ? "ok" : "error",
      detail: fsSupported
        ? "Fullscreen API 지원"
        : "Fullscreen API 미지원 · 다른 브라우저 필요",
    });
    if (supported && fsSupported) {
      setBrowserInfo({
        status: "ok",
        detail: `${browser} · 지원 브라우저 · Fullscreen OK`,
      });
    } else if (supported && !fsSupported) {
      setBrowserInfo({
        status: "error",
        detail: `${browser} · Fullscreen API 미지원 · 다른 브라우저 필요`,
      });
    }
  }, []);

  // 네트워크 응답 시간
  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      try {
        const samples: number[] = [];
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          const res = await fetch(`/api/time?t=${Date.now()}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const t1 = performance.now();
          samples.push(t1 - t0);
        }
        if (cancelled) return;
        const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
        setNetwork({
          status: avg < 300 ? "ok" : avg < 800 ? "warn" : "error",
          detail: `평균 ${avg}ms (${samples.map((s) => Math.round(s)).join(" · ")}ms)`,
        });
      } catch (err) {
        if (cancelled) return;
        setNetwork({
          status: "error",
          detail: err instanceof Error ? err.message : "실패",
        });
      }
    };
    void measure();
    return () => {
      cancelled = true;
    };
  }, []);

  // 웹캠 자동 요청
  const requestWebcam = async () => {
    setWebcam({ status: "pending", detail: "권한 요청 중…" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false, // 마이크 미사용
      });
      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setWebcam({
        status: "ok",
        detail: `${track.label || "웹캠"} · ${settings.width}×${settings.height}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "권한 거부";
      setWebcam({
        status: "error",
        detail: `${message} · 브라우저 주소창 오른쪽 카메라 아이콘에서 허용 후 재시도`,
      });
    }
  };

  // 자동 웹캠 요청 (한 번만)
  useEffect(() => {
    void requestWebcam();
    return () => {
      webcamStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 듀얼 모니터 감지 (Window Management API · Chrome 100+)
  const requestMonitorCheck = async () => {
    setMonitor({ status: "pending", detail: "감지 중…" });
    try {
      // isExtended 우선 시도 (권한 불필요 · Chrome 100+)
      const anyScreen = window.screen as unknown as { isExtended?: boolean };
      if (typeof anyScreen.isExtended === "boolean") {
        if (anyScreen.isExtended) {
          // 여러 모니터 · 정확한 개수는 권한 요청
          try {
            const anyWin = window as unknown as {
              getScreenDetails?: () => Promise<{ screens: unknown[] }>;
            };
            if (anyWin.getScreenDetails) {
              const details = await anyWin.getScreenDetails();
              setMonitor({
                status: "error",
                detail: `듀얼 모니터 감지 · ${details.screens.length}개 연결 · 하나만 사용하도록 나머지 분리 필요`,
              });
              return;
            }
          } catch {
            /* fallthrough */
          }
          setMonitor({
            status: "error",
            detail:
              "듀얼 모니터 감지 (isExtended=true) · 시험 중 단일 모니터만 사용 가능",
          });
          return;
        }
        setMonitor({
          status: "ok",
          detail: "단일 모니터 · 정상",
        });
        return;
      }
      // API 미지원 fallback
      setMonitor({
        status: "warn",
        detail:
          "브라우저에서 모니터 감지 불가 (Chrome 100+ 권장) · 시험 중 반드시 단일 모니터만 사용",
      });
    } catch (err) {
      setMonitor({
        status: "error",
        detail: err instanceof Error ? err.message : "감지 실패",
      });
    }
  };

  // 자동 시도 · 실패해도 사용자 재시도 가능
  useEffect(() => {
    void requestMonitorCheck();
    // 스크린 연결 변경 감지
    const anyScreen = window.screen as unknown as {
      addEventListener?: (t: string, l: () => void) => void;
      removeEventListener?: (t: string, l: () => void) => void;
    };
    const onChange = () => void requestMonitorCheck();
    anyScreen.addEventListener?.("change", onChange);
    return () => {
      anyScreen.removeEventListener?.("change", onChange);
    };
  }, []);

  // 화면 공유 · 사용자 클릭 필요
  const requestScreen = async () => {
    setScreen({ status: "pending", detail: "권한 요청 중…" });
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setScreen({
        status: "ok",
        detail: `${track.label || "화면"} · ${settings.width ?? "?"}×${
          settings.height ?? "?"
        }`,
      });
      // 즉시 정지 (테스트만)
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const message = err instanceof Error ? err.message : "권한 거부";
      setScreen({
        status: "error",
        detail: `${message} · 다시 시도해주세요`,
      });
    }
  };

  const requiredOk =
    webcam.status === "ok" &&
    screen.status === "ok" &&
    fullscreen.status === "ok" &&
    browserInfo.status === "ok" &&
    monitor.status !== "error";
  const networkOk = network.status !== "error";
  const allGood = requiredOk && networkOk;

  const blockers: string[] = [];
  if (webcam.status !== "ok") blockers.push("웹캠");
  if (screen.status !== "ok") blockers.push("화면 공유");
  if (browserInfo.status !== "ok") blockers.push("브라우저");
  if (fullscreen.status !== "ok") blockers.push("Fullscreen API");
  if (monitor.status === "error") blockers.push("듀얼 모니터");
  if (network.status === "error") blockers.push("네트워크");

  const items: {
    n: number;
    title: string;
    result: CheckResult;
    hint: string;
    action?: { label: string; onClick: () => void; primary?: boolean };
    preview?: React.ReactNode;
  }[] = [
    {
      n: 1,
      title: "브라우저",
      result: browserInfo,
      hint: "Chrome 또는 Edge 최신 버전 권장. Fullscreen API 지원 필요.",
    },
    {
      n: 2,
      title: "웹캠",
      result: webcam,
      hint: "시험 중 얼굴이 카메라 안에 계속 잡혀야 합니다.",
      action: { label: "재시도", onClick: requestWebcam },
      preview: (
        <div className="p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-w-md aspect-video rounded-md bg-black object-cover"
          />
        </div>
      ),
    },
    {
      n: 3,
      title: "화면 공유",
      result: screen,
      hint: "감독관이 응시자 화면을 실시간 관찰합니다. 팝업에서 반드시 '전체 화면'을 선택해주세요.",
      action: {
        label: screen.status === "ok" ? "다시 테스트" : "화면 공유 테스트",
        onClick: requestScreen,
        primary: true,
      },
    },
    {
      n: 4,
      title: "듀얼 모니터",
      result: monitor,
      hint: "노트북 외 외부 모니터 · TV · 프로젝터 연결을 모두 해제해주세요. 시험 중 감지되면 응시가 중단됩니다.",
      action: { label: "재감지", onClick: requestMonitorCheck },
    },
    {
      n: 5,
      title: "네트워크",
      result: network,
      hint: "서버 왕복 시간 3회 평균. 300ms 이하 권장 · 800ms 초과 시 지연 가능.",
    },
  ];

  const okCount = items.filter((i) => i.result.status === "ok").length;

  return (
    <div className="space-y-5">
      {/* 헤더 · 진행 상태 */}
      <div className="rounded-md bg-white border border-border p-6">
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
          Step 1 · 응시 환경 체크
        </div>
        <h2>시험 전 필수 확인 5가지</h2>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allGood ? "bg-success" : "bg-primary"
              )}
              style={{ width: `${(okCount / 5) * 100}%` }}
            />
          </div>
          <div className="text-xs font-bold font-tabular text-muted-foreground">
            {okCount} / 5
          </div>
        </div>
      </div>

      {/* 5개 체크 카드 · 세로 스택 */}
      {items.map((item) => (
        <div
          key={item.n}
          className="rounded-md bg-white border border-border overflow-hidden"
        >
          <div className="px-5 py-4 flex items-center gap-4">
            <NumberBadge n={item.n} status={item.result.status} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{item.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {item.result.detail}
              </div>
            </div>
            {item.action && (
              <button
                onClick={item.action.onClick}
                className={cn(
                  "h-8 px-3 rounded-sm text-xs font-bold transition shrink-0",
                  item.action.primary
                    ? "bg-primary hover:bg-primary-hover text-white"
                    : "bg-white border border-border hover:border-primary text-foreground"
                )}
              >
                {item.action.label}
              </button>
            )}
          </div>
          {item.preview}
          <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
            {item.hint}
          </div>
        </div>
      ))}

      {/* 종합 결과 + 진입 CTA */}
      <div
        className={cn(
          "rounded-md p-5 border-2",
          allGood
            ? "border-success bg-success-soft"
            : "border-warning bg-warning-soft"
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-sm flex items-center justify-center font-bold text-lg",
              allGood ? "bg-success text-white" : "bg-warning text-white"
            )}
          >
            {allGood ? "✓" : "!"}
          </div>
          <div className="flex-1">
            <div
              className={cn(
                "font-bold text-sm",
                allGood ? "text-success" : "text-warning"
              )}
            >
              {allGood ? "환경 체크 통과" : "환경 체크 미완료"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {allGood
                ? "모든 항목이 정상입니다. 아래 버튼으로 시험창으로 이동하세요."
                : `아직 통과하지 못한 항목: ${blockers.join(", ")}`}
            </div>
          </div>
        </div>

        {onEnterExam && (
          <button
            onClick={onEnterExam}
            disabled={!allGood}
            className={cn(
              "w-full h-14 rounded-md font-bold text-base transition",
              allGood
                ? "bg-primary hover:bg-primary-hover text-white shadow-sm"
                : "bg-subtle text-muted cursor-not-allowed"
            )}
          >
            {allGood
              ? "시험창으로 진입 →"
              : "위 항목을 모두 통과해야 진입 가능"}
          </button>
        )}
      </div>

      {/* Fullscreen 상태 (숨김 처리 · 에러 시만 노출) */}
      {fullscreen.status === "error" && (
        <div className="text-xs text-danger">
          Fullscreen API 미지원: {fullscreen.detail}
        </div>
      )}
    </div>
  );
}

function NumberBadge({ n, status }: { n: number; status: CheckStatus }) {
  const style = {
    pending: "bg-subtle text-muted",
    ok: "bg-success text-white",
    warn: "bg-warning text-white",
    error: "bg-danger text-white",
  }[status];
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 font-tabular",
        style
      )}
    >
      {status === "ok" ? "✓" : n}
    </div>
  );
}
