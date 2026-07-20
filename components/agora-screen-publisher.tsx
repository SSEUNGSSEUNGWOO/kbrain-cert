"use client";

import { useEffect, useState } from "react";

export function AgoraScreenPublisher({
  sessionId,
  screenStream,
  active,
  onFailure,
}: {
  sessionId: string | null;
  screenStream: MediaStream | null;
  active: boolean;
  onFailure: () => void;
}) {
  const [status, setStatus] = useState<"connecting" | "live" | "error">(
    "connecting"
  );

  useEffect(() => {
    const mediaTrack = screenStream?.getVideoTracks()[0];
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
            body: JSON.stringify({ mode: "applicant", media: "screen" }),
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
                media: "screen",
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
          .applyConstraints({ width: 640, height: 360, frameRate: 2 })
          .catch(() => {});
        const videoTrack = AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: mediaTrack,
          bitrateMin: 100,
          bitrateMax: 250,
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
  }, [active, sessionId, screenStream, onFailure]);

  if (!active || !sessionId || !screenStream) return null;
  return (
    <div className="fixed right-6 bottom-[250px] z-40 rounded-sm bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
      {status === "live"
        ? "● 감독관 화면 송출 중"
        : status === "error"
        ? "화면 송출 연결 실패"
        : "화면 송출 연결 중…"}
    </div>
  );
}
