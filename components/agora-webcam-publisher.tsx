"use client";

import { useEffect, useState } from "react";
import type { IAgoraRTCClient } from "agora-rtc-sdk-ng";

const RETRY_DELAY_MS = 30_000;

export function AgoraWebcamPublisher({
  sessionId,
  webcamStream,
  active,
  onFailure,
}: {
  sessionId: string | null;
  webcamStream: MediaStream | null;
  active: boolean;
  onFailure: () => void;
}) {
  const [status, setStatus] = useState<"connecting" | "live" | "error">(
    "connecting"
  );

  useEffect(() => {
    const mediaTrack = webcamStream?.getVideoTracks()[0];
    if (!active || !sessionId || !mediaTrack) return;
    let cancelled = false;
    let cleanup: (() => Promise<void>) | undefined;
    let retryId: number | null = null;

    const connect = async () => {
      let client: IAgoraRTCClient | null = null;
      try {
        const [AgoraRTC, response] = await Promise.all([
          import("agora-rtc-sdk-ng").then((module) => module.default),
          fetch("/api/agora/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "applicant", media: "webcam" }),
          }),
        ]);
        const config = await response.json();
        if (!response.ok) throw new Error(config.error ?? "Agora token failed");
        if (cancelled) return;

        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        await client.join(config.appId, config.channel, config.token, config.uid);
        // join 대기 중 unmount 된 경우 즉시 leave (좀비 연결 · minute 소진 방지)
        if (cancelled) {
          await client.leave().catch(() => {});
          return;
        }
        const activeClient = client;
        const renewToken = () => {
          void (async () => {
            const tokenResponse = await fetch("/api/agora/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "applicant",
                media: "webcam",
                uid: config.uid,
              }),
            });
            const renewed = await tokenResponse.json();
            if (!tokenResponse.ok) throw new Error("Agora token renewal failed");
            await activeClient.renewToken(renewed.token);
          })().catch(() => {
            if (!cancelled) {
              setStatus("error");
              onFailure();
            }
          });
        };
        activeClient.on("token-privilege-will-expire", renewToken);
        activeClient.on("token-privilege-did-expire", renewToken);
        await mediaTrack
          .applyConstraints({ width: 320, height: 240, frameRate: 10 })
          .catch(() => {});
        const videoTrack = AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: mediaTrack,
          bitrateMin: 100,
          bitrateMax: 200,
        });
        let trackClosed = false;
        const closeTrack = () => {
          if (trackClosed) return;
          trackClosed = true;
          videoTrack.stop();
          videoTrack.close();
          void activeClient.unpublish(videoTrack).catch(() => {});
        };
        mediaTrack.addEventListener("ended", closeTrack);
        await activeClient.publish(videoTrack);

        cleanup = async () => {
          activeClient.off("token-privilege-will-expire", renewToken);
          activeClient.off("token-privilege-did-expire", renewToken);
          mediaTrack.removeEventListener("ended", closeTrack);
          closeTrack();
          await activeClient.leave().catch(() => {});
        };
        // publish 대기 중 unmount 된 경우 · cleanup 이 unmount 시점에 못 잡았으므로 여기서 정리
        if (cancelled) {
          const done = cleanup;
          cleanup = undefined;
          await done();
          return;
        }
        setStatus("live");
      } catch {
        // join 까지 성공했다면 leave 로 원복 후 재시도
        if (client) await client.leave().catch(() => {});
        if (!cancelled) {
          setStatus("error");
          onFailure();
          // 일시적 실패 (토큰 API·네트워크) 로 시험 내내 송출 사각지대가 되지 않도록 자동 재시도
          retryId = window.setTimeout(() => void connect(), RETRY_DELAY_MS);
        }
      }
    };
    void connect();

    // 브라우저 탭 강제 close/새로고침 시 Agora client 즉시 leave (Agora minute 소진 방지)
    const onUnload = () => {
      if (cleanup) void cleanup();
    };
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      if (retryId != null) window.clearTimeout(retryId);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
      if (cleanup) void cleanup();
    };
  }, [active, sessionId, webcamStream, onFailure]);

  // 응시자 화면에는 송출 상태 표시하지 않음 (감독관 측에서 스트림 유무로 판단)
  void status;
  return null;
}
