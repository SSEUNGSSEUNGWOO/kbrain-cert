"use client";

import { useEffect, useState } from "react";

export function AgoraWebcamPublisher({
  sessionId,
  webcamStream,
}: {
  sessionId: string | null;
  webcamStream: MediaStream | null;
}) {
  const [status, setStatus] = useState<"connecting" | "live" | "error">(
    "connecting"
  );

  useEffect(() => {
    const mediaTrack = webcamStream?.getVideoTracks()[0];
    if (!sessionId || !mediaTrack) return;
    let cancelled = false;
    let cleanup: (() => Promise<void>) | undefined;

    void (async () => {
      try {
        const [AgoraRTC, response] = await Promise.all([
          import("agora-rtc-sdk-ng").then((module) => module.default),
          fetch("/api/agora/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "applicant" }),
          }),
        ]);
        const config = await response.json();
        if (!response.ok) throw new Error(config.error ?? "Agora token failed");
        if (cancelled) return;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        await client.join(config.appId, config.channel, config.token, config.uid);
        const videoTrack = AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: mediaTrack,
        });
        await client.publish(videoTrack);
        if (!cancelled) setStatus("live");

        cleanup = async () => {
          await client.unpublish(videoTrack).catch(() => {});
          videoTrack.close();
          await client.leave().catch(() => {});
        };
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) void cleanup();
    };
  }, [sessionId, webcamStream]);

  if (!sessionId || !webcamStream) return null;
  return (
    <div className="fixed right-6 bottom-[278px] z-40 rounded-sm bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
      {status === "live"
        ? "● 감독관 웹캠 송출 중"
        : status === "error"
        ? "웹캠 송출 연결 실패"
        : "웹캠 송출 연결 중…"}
    </div>
  );
}
