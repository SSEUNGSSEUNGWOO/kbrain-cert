"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CheckStatus = "pending" | "ok" | "warn" | "error";

type CheckResult = {
  status: CheckStatus;
  detail: string;
};

export type EnvResultSnapshot = {
  monitor: { status: CheckStatus; detail: string };
  webcam: { status: CheckStatus; detail: string };
  screen: { status: CheckStatus; detail: string };
  network: { status: CheckStatus; detail: string };
  cpu: { status: CheckStatus; detail: string };
  browser: { status: CheckStatus; detail: string };
};

/**
 * 응시 환경 체크 · Practice 페이지에서 실전 전 확인용
 * - 웹캠: getUserMedia · 프리뷰
 * - 화면공유: getDisplayMedia · 사용자 클릭 필요
 * - 브라우저: 지원 브라우저 여부
 * - 네트워크: fetch로 응답 시간 측정
 *
 * 스트림 (webcam, screen)은 상위 컴포넌트가 관리 · 환경 체크 → 시험 종료까지 유지
 * onEnterExam 콜백이 있으면 통과 시 CTA 버튼 표시 · 실 시험이면 snapshot을 서버에 저장
 */
export function EnvCheck({
  onEnterExam,
  webcamStream,
  setWebcamStream,
  screenStream,
  setScreenStream,
  allowNoWebcam = false,
  allowNoScreenShare = false,
  allowDualMonitor = false,
}: {
  onEnterExam?: (snapshot: EnvResultSnapshot) => void;
  webcamStream: MediaStream | null;
  setWebcamStream: (s: MediaStream | null) => void;
  screenStream: MediaStream | null;
  setScreenStream: (s: MediaStream | null) => void;
  allowNoWebcam?: boolean;
  allowNoScreenShare?: boolean;
  allowDualMonitor?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [browserInfo, setBrowserInfo] = useState<CheckResult>({
    status: "pending",
    detail: "확인 중…",
  });
  const [webcam, setWebcam] = useState<CheckResult>(
    allowNoWebcam
      ? { status: "ok", detail: "관리자 승인 · 웹캠 면제" }
      : webcamStream
      ? { status: "ok", detail: "웹캠 활성 · 시험까지 유지" }
      : { status: "pending", detail: "권한 요청 대기" }
  );
  const [screen, setScreen] = useState<CheckResult>(
    allowNoScreenShare
      ? { status: "ok", detail: "관리자 승인 · 화면 공유 면제" }
      : screenStream
      ? { status: "ok", detail: "화면 공유 활성 · 시험까지 유지" }
      : { status: "pending", detail: "테스트 버튼 클릭" }
  );
  const [network, setNetwork] = useState<CheckResult>({
    status: "pending",
    detail: "측정 중…",
  });
  const [monitor, setMonitor] = useState<CheckResult>({
    status: allowDualMonitor ? "ok" : "pending",
    detail: allowDualMonitor
      ? "관리자 승인 · 듀얼 모니터 허용"
      : "감지 시작 버튼 클릭",
  });
  const [cpu, setCpu] = useState<CheckResult>({
    status: "pending",
    detail: "측정 대기",
  });
  // 사용자가 X로 닫은 detail을 기억 · 재감지 후 결과가 바뀌면 모달 다시 자동 오픈
  const [dismissedMonitorDetail, setDismissedMonitorDetail] = useState<
    string | null
  >(null);
  const monitorModalOpen =
    !allowDualMonitor &&
    monitor.status === "error" &&
    dismissedMonitorDetail !== monitor.detail;

  // 브라우저 정보 · Fullscreen 지원
  useEffect(() => {
    const timer = window.setTimeout(() => {
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
        detail: supported
          ? `${browser} · 지원 브라우저`
          : `${browser} · 권장 X (Chrome/Edge 사용 권장)`,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 네트워크 응답 시간 · 재측정 가능
  const measureNetwork = async () => {
    setNetwork({ status: "pending", detail: "측정 중…" });
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
      const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
      setNetwork({
        status: avg < 300 ? "ok" : avg < 800 ? "warn" : "error",
        detail: `평균 ${avg}ms (${samples.map((s) => Math.round(s)).join(" · ")}ms)`,
      });
    } catch (err) {
      setNetwork({
        status: "error",
        detail: err instanceof Error ? err.message : "실패",
      });
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void measureNetwork(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 웹캠 요청 · 스트림은 부모가 유지 (시험 종료까지)
  const requestWebcam = async (deviceId?: string) => {
    setWebcam({ status: "pending", detail: "권한 요청 중…" });
    const previousStream = webcamStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 320,
          height: 240,
          frameRate: 10,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        audio: false,
      });
      previousStream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      setWebcamStream(stream);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      setCameras(videoDevices);
      setSelectedCameraId(settings.deviceId ?? deviceId ?? "");
      const label = track.label || "웹캠";
      const isVirtual = /virtual|obs |snap camera|xsplit|manycam|droidcam|mirametrix/i.test(
        label
      );
      if (isVirtual) {
        setWebcam({
          status: "warn",
          detail: `가상 카메라 감지: ${label} · 실제 웹캠 선택 필요`,
        });
      } else {
        setWebcam({
          status: "ok",
          detail: `${label} · ${settings.width}×${settings.height} · 시험까지 유지`,
        });
      }
      // 트랙이 예상치 못하게 끝나면 (사용자가 OS에서 카메라 강제 해제) 상태 반영
      track.onended = () => {
        setWebcamStream(null);
        setWebcam({
          status: "error",
          detail: "웹캠 연결이 끊어졌습니다. 재시도해주세요.",
        });
      };
    } catch (err) {
      const previousTrack = previousStream?.getVideoTracks()[0];
      if (previousTrack?.readyState === "live") {
        setWebcam({
          status: "ok",
          detail: `${previousTrack.label || "기존 웹캠"} · 기존 연결 유지`,
        });
        return;
      }
      const message = err instanceof Error ? err.message : "권한 거부";
      setWebcam({
        status: "error",
        detail: `${message} · 브라우저 주소창 오른쪽 카메라 아이콘에서 허용 후 재시도`,
      });
    }
  };

  // 최초 진입 시 웹캠 자동 요청 · 이미 활성이면 프리뷰만 연결
  useEffect(() => {
    if (allowNoWebcam) return;
    if (webcamStream) return;
    const timer = window.setTimeout(() => void requestWebcam(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowNoWebcam]);

  // 프리뷰 재연결 (탭 재진입 시)
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [webcamStream]);

  // 웹캠 실사 검증 · 3초 간격 프레임 샘플링
  // 검정 프레임(원격 세션·렌즈 셔터), 정적 이미지(가상 카메라 아이콘), 프레임 정지 모두 감지
  useEffect(() => {
    if (allowNoWebcam || !webcamStream) return;
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let consecutiveBad = 0;
    let prevPixels: Uint8ClampedArray | null = null;
    const STRIKES = 2;
    const DARK_AVG = 10; // 매우 어두운 프레임 (검정)
    const FLAT_STDDEV = 8; // 픽셀 밝기 편차 낮음 = 단조로운 프레임
    const STATIC_DIFF = 3; // 이전 프레임과 거의 동일 = 정지 이미지

    const W = 32;
    const H = 24;
    const PIXEL_COUNT = W * H;

    const sample = () => {
      if (!video.videoWidth || !video.videoHeight) {
        // 프레임 자체가 없음 = 검정 취급
        consecutiveBad += 1;
        if (consecutiveBad >= STRIKES) {
          setWebcam({
            status: "warn",
            detail: "웹캠 프레임 없음 · 카메라 연결 상태 확인 필요",
          });
        }
        return;
      }
      canvas.width = W;
      canvas.height = H;
      try {
        ctx.drawImage(video, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        // 밝기 평균 (Rec.709 luma)
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum +=
            0.2126 * data[i] +
            0.7152 * data[i + 1] +
            0.0722 * data[i + 2];
        }
        const avg = sum / PIXEL_COUNT;

        // 표준편차 · 정적/단조 프레임 판별
        let variance = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum =
            0.2126 * data[i] +
            0.7152 * data[i + 1] +
            0.0722 * data[i + 2];
          variance += (lum - avg) ** 2;
        }
        const stddev = Math.sqrt(variance / PIXEL_COUNT);

        // 이전 프레임과 diff · 정지 이미지 판별
        let frameDiff = Infinity;
        if (prevPixels) {
          let diffSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            diffSum +=
              Math.abs(data[i] - prevPixels[i]) +
              Math.abs(data[i + 1] - prevPixels[i + 1]) +
              Math.abs(data[i + 2] - prevPixels[i + 2]);
          }
          frameDiff = diffSum / (PIXEL_COUNT * 3);
        }
        prevPixels = new Uint8ClampedArray(data);

        const isDark = avg < DARK_AVG;
        const isFlat = stddev < FLAT_STDDEV;
        const isStatic = frameDiff < STATIC_DIFF;
        const bad = isDark || (isFlat && isStatic);

        if (bad) {
          consecutiveBad += 1;
          if (consecutiveBad >= STRIKES) {
            const reason = isDark
              ? "웹캠 프레임이 검정 · 렌즈 셔터·다른 앱 점유·원격 세션 여부 확인"
              : "웹캠 프레임이 정지 이미지 · 실제 웹캠 선택 필요 (가상 카메라 사용 금지)";
            setWebcam({ status: "warn", detail: reason });
          }
        } else {
          const wasBad = consecutiveBad >= STRIKES;
          consecutiveBad = 0;
          if (wasBad) {
            setWebcam({
              status: "ok",
              detail: "웹캠 활성 · 시험까지 유지",
            });
          }
        }
      } catch {
        /* CORS·SecurityError 등 · 다음 회차에서 재시도 */
      }
    };

    const initialId = window.setTimeout(sample, 1500);
    const intervalId = window.setInterval(sample, 3000);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
    };
  }, [webcamStream, allowNoWebcam]);

  // 듀얼 모니터 감지 · getScreenDetails 우선(복제 모드도 감지) · isExtended fallback
  const requestMonitorCheck = async () => {
    setMonitor({ status: "pending", detail: "감지 중…" });
    try {
      const anyWin = window as unknown as {
        getScreenDetails?: () => Promise<{ screens: unknown[] }>;
      };
      // 1순위 · Window Management API로 물리 모니터 개수 확인 (복제 모드 포함)
      if (typeof anyWin.getScreenDetails === "function") {
        try {
          const details = await anyWin.getScreenDetails();
          const count = details.screens.length;
          if (count > 1) {
            setMonitor({
              status: "error",
              detail: `${count}개의 모니터가 연결됨`,
            });
            return;
          }
          setMonitor({ status: "ok", detail: "단일 모니터 · 정상" });
          return;
        } catch {
          // 권한 거부 · fallback
        }
      }
      // 2순위 · isExtended (확장만 감지 · 복제는 놓칠 수 있음)
      const anyScreen = window.screen as unknown as { isExtended?: boolean };
      if (typeof anyScreen.isExtended === "boolean") {
        if (anyScreen.isExtended) {
          setMonitor({
            status: "error",
            detail: "확장 모니터 감지 (isExtended=true)",
          });
          return;
        }
        setMonitor({
          status: "warn",
          detail:
            "확장 모니터 미감지 · 화면 복제 모드는 감지 불가 · 반드시 단일 모니터만 사용",
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
    if (allowDualMonitor) return;
    const timer = window.setTimeout(() => void requestMonitorCheck(), 0);
    // 스크린 연결 변경 감지
    const anyScreen = window.screen as unknown as {
      addEventListener?: (t: string, l: () => void) => void;
      removeEventListener?: (t: string, l: () => void) => void;
    };
    const onChange = () => void requestMonitorCheck();
    anyScreen.addEventListener?.("change", onChange);
    return () => {
      window.clearTimeout(timer);
      anyScreen.removeEventListener?.("change", onChange);
    };
  }, [allowDualMonitor]);

  // CPU 벤치마크 · 웹캠+화면공유 인코딩 동시 처리 가능한지 대략 확인
  const runCpuBenchmark = async () => {
    setCpu({ status: "pending", detail: "측정 중…" });
    // 다음 프레임에서 실행 · UI 블록 방지
    await new Promise((r) => setTimeout(r, 50));
    const cores = navigator.hardwareConcurrency || 0;
    const N = 5_000_000;
    const t0 = performance.now();
    let sink = 0;
    for (let i = 0; i < N; i++) {
      sink += Math.sqrt(i * Math.PI) * Math.sin(i);
    }
    const elapsed = performance.now() - t0;
    // sink 최적화 방지
    if (!Number.isFinite(sink)) console.debug(sink);

    let status: CheckStatus;
    let verdict: string;
    if (cores < 2 || elapsed > 800) {
      status = "error";
      verdict = "성능 부족 · 시험 중 지연 가능";
    } else if (cores < 4 || elapsed > 400) {
      status = "warn";
      verdict = "권장 사양 미달 · 다른 앱 종료 필요";
    } else {
      status = "ok";
      verdict = "인코딩 여유 있음";
    }
    setCpu({
      status,
      detail: `${cores}코어 · 벤치 ${Math.round(elapsed)}ms · ${verdict}`,
    });
  };

  useEffect(() => {
    // 첫 렌더 후 idle 시점에 실행
    const id = setTimeout(() => void runCpuBenchmark(), 500);
    return () => clearTimeout(id);
  }, []);

  // 화면 공유 · 사용자 클릭 필요 · 스트림은 시험 종료까지 유지
  const requestScreen = async () => {
    setScreen({ status: "pending", detail: "권한 요청 중…" });
    const previousStream = screenStream;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
      } as DisplayMediaStreamOptions);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const displaySurface = (
        settings as MediaTrackSettings & { displaySurface?: string }
      ).displaySurface;
      if (!allowNoScreenShare && displaySurface && displaySurface !== "monitor") {
        stream.getTracks().forEach((streamTrack) => streamTrack.stop());
        const previousTrack = previousStream?.getVideoTracks()[0];
        setScreen(
          previousTrack?.readyState === "live"
            ? {
                status: "ok",
                detail: "창·탭 선택을 거부하고 기존 전체 화면 공유를 유지합니다.",
              }
            : {
                status: "error",
                detail: "창이나 탭이 아닌 '전체 화면'을 선택해야 합니다.",
              }
        );
        return;
      }
      previousStream?.getTracks().forEach((previousTrack) => {
        previousTrack.onended = null;
        previousTrack.stop();
      });
      setScreenStream(stream);
      setScreen({
        status: "ok",
        detail: `${track.label || "화면"} · ${settings.width ?? "?"}×${
          settings.height ?? "?"
        } · 시험까지 유지`,
      });
      // 브라우저 상단 "공유 중지" 클릭 감지
      track.onended = () => {
        setScreenStream(null);
        setScreen({
          status: "error",
          detail: "화면 공유가 중지되었습니다. 다시 시도해주세요.",
        });
      };
    } catch (err) {
      const previousTrack = previousStream?.getVideoTracks()[0];
      if (previousTrack?.readyState === "live") {
        setScreen({
          status: "ok",
          detail: "새 요청이 취소되어 기존 전체 화면 공유를 유지합니다.",
        });
        return;
      }
      const message = err instanceof Error ? err.message : "권한 거부";
      setScreen({
        status: "error",
        detail: `${message} · 다시 시도해주세요`,
      });
    }
  };

  const requiredOk =
    (allowNoWebcam || webcam.status === "ok") &&
    (allowNoScreenShare || screen.status === "ok") &&
    browserInfo.status === "ok" &&
    (allowDualMonitor || monitor.status !== "error") &&
    cpu.status !== "error";
  const networkOk = network.status !== "error";
  const allGood = requiredOk && networkOk;

  const blockers: string[] = [];
  if (!allowDualMonitor && monitor.status === "error") blockers.push("듀얼 모니터");
  if (!allowNoWebcam && webcam.status !== "ok") blockers.push("웹캠");
  if (!allowNoScreenShare && screen.status !== "ok") blockers.push("화면 공유");
  if (network.status === "error") blockers.push("네트워크");
  if (cpu.status === "error") blockers.push("CPU");
  if (browserInfo.status !== "ok") blockers.push("브라우저");

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
      title: "듀얼 모니터",
      result: monitor,
      hint: allowDualMonitor
        ? "관리자가 이 응시자의 듀얼 모니터 사용을 허용했습니다."
        : "노트북 외 외부 모니터 · TV · 프로젝터 연결을 모두 해제해주세요. 시험 중 감지되면 응시가 중단됩니다.",
      action: allowDualMonitor
        ? undefined
        : { label: "재감지", onClick: requestMonitorCheck },
    },
    {
      n: 2,
      title: "웹캠",
      result: webcam,
      hint: allowNoWebcam
        ? "관리자가 이 응시자의 웹캠 사용을 면제했습니다."
        : "시험 중 얼굴이 카메라 안에 계속 잡혀야 합니다.",
      action: allowNoWebcam
        ? undefined
        : {
            label: "웹캠 다시 연결",
            onClick: () => void requestWebcam(),
          },
      preview: allowNoWebcam ? undefined : (
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black p-4">
          {cameras.length > 1 && (
            <label className="mx-auto mb-3 block max-w-md text-xs font-bold text-white">
              사용할 웹캠
              <select
                value={selectedCameraId}
                onChange={(event) => {
                  const deviceId = event.target.value;
                  setSelectedCameraId(deviceId);
                  void requestWebcam(deviceId);
                }}
                className="mt-1 h-10 w-full rounded-md border border-white/20 bg-slate-800 px-3 text-sm text-white"
              >
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `카메라 ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-video w-full max-w-md rounded-md bg-black object-cover"
            />
          </div>
        </div>
      ),
    },
    {
      n: 3,
      title: "화면 공유",
      result: screen,
      hint: allowNoScreenShare
        ? "이 시험은 화면 공유 없이 응시할 수 있습니다."
        : "감독관이 응시자 화면을 실시간 관찰합니다. 팝업에서 반드시 '전체 화면'을 선택해주세요.",
      action: allowNoScreenShare
        ? undefined
        : {
            label: "화면 공유",
            onClick: requestScreen,
            primary: true,
          },
    },
    {
      n: 4,
      title: "네트워크",
      result: network,
      hint: "서버 왕복 시간 3회 평균. 300ms 이하 권장 · 800ms 초과 시 지연 가능.",
      action: { label: "재측정", onClick: measureNetwork },
    },
    {
      n: 5,
      title: "CPU 성능",
      result: cpu,
      hint: "웹캠 인코딩 + 화면 공유 압축을 동시에 처리하려면 4코어 이상 권장. 저사양 노트북은 다른 앱을 모두 종료해주세요.",
      action: { label: "재측정", onClick: runCpuBenchmark },
    },
    {
      n: 6,
      title: "브라우저",
      result: browserInfo,
      hint: "Chrome 또는 Edge 최신 버전 권장. Fullscreen API 지원 필요.",
    },
  ];

  const okCount = items.filter((i) => i.result.status === "ok").length;
  const total = items.length;

  return (
    <>
    <div className="space-y-5">
      {/* 헤더 · 진행 상태 */}
      <div className="rounded-md bg-white border border-border p-6">
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
          Step 1 · 응시 환경 체크
        </div>
        <h2>시험 전 필수 확인 {total}가지</h2>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allGood ? "bg-success" : "bg-primary"
              )}
              style={{ width: `${(okCount / total) * 100}%` }}
            />
          </div>
          <div className="text-xs font-bold font-tabular text-muted-foreground">
            {okCount} / {total}
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
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold">{item.title}</div>
                {item.result.status === "ok" && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-success">
                    <span aria-hidden>✓</span>확인 완료
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {item.result.detail}
              </div>
            </div>
            {item.action && (
              <button
                onClick={item.action.onClick}
                disabled={item.result.status === "ok"}
                className={cn(
                  "h-8 px-3 rounded-sm text-xs font-bold transition shrink-0",
                  item.result.status === "ok"
                    ? "bg-surface-soft text-muted cursor-not-allowed opacity-50"
                    : item.action.primary
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
            onClick={() =>
              onEnterExam?.({
                monitor: { status: monitor.status, detail: monitor.detail },
                webcam: { status: webcam.status, detail: webcam.detail },
                screen: { status: screen.status, detail: screen.detail },
                network: { status: network.status, detail: network.detail },
                cpu: { status: cpu.status, detail: cpu.detail },
                browser: {
                  status: browserInfo.status,
                  detail: browserInfo.detail,
                },
              })
            }
            disabled={!allGood}
            className={cn(
              "w-full h-14 rounded-md font-bold text-base transition",
              allGood
                ? "bg-primary hover:bg-primary-hover text-white shadow-sm"
                : "bg-subtle text-muted cursor-not-allowed"
            )}
          >
            {allGood
              ? "보안 서약으로 이동 →"
              : "위 항목을 모두 통과해야 진행 가능"}
          </button>
        )}
      </div>

    </div>

    {/* 듀얼 모니터 감지 시 자동 팝업 · 사용자가 X로 닫아도 재감지 후 여전히 감지되면 재오픈 */}
    {monitorModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitor-modal-title"
      >
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-2xl">
          <button
            type="button"
            onClick={() => setDismissedMonitorDetail(monitor.detail)}
            aria-label="닫기"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground text-lg"
          >
            ×
          </button>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl" aria-hidden>⚠</span>
              <h3
                id="monitor-modal-title"
                className="font-bold text-lg text-danger"
              >
                듀얼 모니터 감지
              </h3>
            </div>
            <p className="text-sm text-foreground mb-3">
              {monitor.detail}
            </p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              시험의 공정성을 위해{" "}
              <strong className="text-foreground">단일</strong> 모니터만
              사용해야 합니다. 추가 모니터의 연결을 해제한 후 다시 시도해 주세요.
            </p>
            <div className="rounded-md bg-surface-soft border border-border p-4 mb-6">
              <div className="text-xs font-bold text-foreground mb-2">
                해결 방법:
              </div>
              <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                <li>추가 모니터의 케이블을 분리하세요</li>
                <li>
                  Windows 디스플레이 설정에서{" "}
                  <strong className="text-foreground">1에만 표시</strong> 또는{" "}
                  <strong className="text-foreground">2에만 표시</strong>로 변경
                  (복제·확장 모드는 모두 금지됩니다)
                </li>
                <li>노트북의 경우 외부 모니터 연결을 해제하세요</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDismissedMonitorDetail(null);
                  void requestMonitorCheck();
                }}
                className="h-10 px-5 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold transition"
              >
                다시 확인
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
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
