"use client";

import { useEffect, useState } from "react";

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

    void (async () => {
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

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        await client.join(config.appId, config.channel, config.token, config.uid);
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
            await client.renewToken(renewed.token);
          })().catch(() => {
            if (!cancelled) {
              setStatus("error");
              onFailure();
            }
          });
        };
        client.on("token-privilege-will-expire", renewToken);
        client.on("token-privilege-did-expire", renewToken);
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
          void client.unpublish(videoTrack).catch(() => {});
        };
        mediaTrack.addEventListener("ended", closeTrack);
        await client.publish(videoTrack);
        if (!cancelled) setStatus("live");

        cleanup = async () => {
          client.off("token-privilege-will-expire", renewToken);
          client.off("token-privilege-did-expire", renewToken);
          mediaTrack.removeEventListener("ended", closeTrack);
          closeTrack();
          await client.leave().catch(() => {});
        };
      } catch {
        if (!cancelled) {
          setStatus("error");
          onFailure();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) void cleanup();
    };
  }, [active, sessionId, webcamStream, onFailure]);

  // 응시자 화면에는 송출 상태 표시하지 않음 (감독관 측에서 스트림 유무로 판단)
  void status;
  return null;
}
