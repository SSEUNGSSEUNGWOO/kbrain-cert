"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClientSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AGORA_SHARD_COUNT, getAgoraShard } from "@/lib/agora-channel";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";

type Session = {
  sessionId: string;
  status: string;
  startTime: string | null;
  isFlagged: boolean;
  applicantName: string;
  applicantEmail: string;
  organization: string;
  highCount: number;
  unreadMessageCount: number;
  latestUnreadMessage: {
    content: string;
    createdAt: string;
  } | null;
  latestMessage: {
    senderRole: string;
    content: string;
    createdAt: string;
  } | null;
  lastEvent: {
    eventType: string;
    severity: string;
    detectedAt: string;
  } | null;
};

type ChatMessage = {
  id: number;
  sender_role: string;
  content: string;
  is_announcement: boolean;
  created_at: string;
  read_at: string | null;
};

type MonitorEvent = {
  id: number;
  sessionId: string;
  eventType: string;
  severity: string;
  detectedAt: string;
  questionIndex: number | null;
  applicantName: string;
  payload: unknown;
};

const EVENT_LABEL: Record<string, string> = {
  fullscreen_exit: "전체화면 이탈",
  tab_switch: "탭 전환",
  window_blur: "윈도우 blur",
  copy_blocked: "복사 시도",
  context_menu_blocked: "우클릭",
  devtools_attempt: "DevTools",
  screenshot_attempt: "스크린샷",
  shortcut_blocked: "단축키 차단",
  print_attempt: "인쇄 시도",
  navigation_attempt: "페이지 나가기",
  face_missing: "얼굴 미검출",
  multiple_faces: "다인원 감지",
};

type SeverityFilter = "all" | "high" | "info";
const MAX_LIVE_WEBCAMS = 8;
const REALTIME_REFRESH_DELAY_MS = 750;

export function MonitorLive({
  exam,
}: {
  exam: { id: string; title: string; durationMinutes: number; examDate: string | null };
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [mediaPage, setMediaPage] = useState(0);
  const [rightPanel, setRightPanel] = useState<"chat" | "events">("chat");
  const [expandedView, setExpandedView] = useState<"screen" | "webcam">("screen");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "live" | "polling"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [announcementResult, setAnnouncementResult] = useState<string | null>(null);
  const [batchEndOpen, setBatchEndOpen] = useState(false);
  const [videoTracks, setVideoTracks] = useState<
    Record<string, IRemoteVideoTrack>
  >({});
  const [screenTracks, setScreenTracks] = useState<
    Record<string, IRemoteVideoTrack>
  >({});
  const sessionIdsRef = useRef<Set<string>>(new Set());
  const webcamClientRef = useRef<IAgoraRTCClient | null>(null);
  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const screenUsersRef = useRef<Map<string, IAgoraRTCRemoteUser>>(new Map());
  const webcamUsersRef = useRef<Map<string, IAgoraRTCRemoteUser>>(new Map());
  const webcamUidRef = useRef<Map<string, string>>(new Map());
  const screenUidRef = useRef<Map<string, string>>(new Map());
  const desiredWebcamsRef = useRef<Set<string>>(new Set());
  const selectedSessionRef = useRef<string | null>(null);
  const subscribedWebcamsRef = useRef<Set<string>>(new Set());
  const subscribedScreenRef = useRef<string | null>(null);

  useEffect(() => {
    const ordered = sessions.filter(
      (session) => getAgoraShard(session.sessionId) === mediaPage
    ).sort((a, b) => {
      if (a.sessionId === selectedSession) return -1;
      if (b.sessionId === selectedSession) return 1;
      const aPriority = a.unreadMessageCount > 0
        ? 3
        : a.isFlagged || a.highCount > 0
        ? 2
        : 0;
      const bPriority = b.unreadMessageCount > 0
        ? 3
        : b.isFlagged || b.highCount > 0
        ? 2
        : 0;
      return bPriority - aPriority;
    });
    const desired = new Set(
      ordered.slice(0, MAX_LIVE_WEBCAMS).map((item) => item.sessionId)
    );
    desiredWebcamsRef.current = desired;
    const client = webcamClientRef.current;
    if (!client) return;
    for (const [sessionId, user] of webcamUsersRef.current) {
      if (desired.has(sessionId) && !subscribedWebcamsRef.current.has(sessionId)) {
        subscribedWebcamsRef.current.add(sessionId);
        void client.subscribe(user, "video").then(() => {
          if (user.videoTrack) {
            setVideoTracks((current) => ({
              ...current,
              [sessionId]: user.videoTrack!,
            }));
          }
        }).catch(() => subscribedWebcamsRef.current.delete(sessionId));
      } else if (
        !desired.has(sessionId) &&
        subscribedWebcamsRef.current.has(sessionId)
      ) {
        subscribedWebcamsRef.current.delete(sessionId);
        void client.unsubscribe(user, "video").catch(() => {});
        setVideoTracks((current) => {
          const next = { ...current };
          next[sessionId]?.stop();
          delete next[sessionId];
          return next;
        });
      }
    }
  }, [mediaPage, selectedSession, sessions]);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
    const client = screenClientRef.current;
    if (!client) return;
    const previousSession = subscribedScreenRef.current;
    if (previousSession && previousSession !== selectedSession) {
      const previousUser = screenUsersRef.current.get(previousSession);
      if (previousUser) void client.unsubscribe(previousUser, "video").catch(() => {});
      subscribedScreenRef.current = null;
      setScreenTracks({});
    }
    if (!selectedSession || previousSession === selectedSession) return;
    const user = screenUsersRef.current.get(selectedSession);
    if (!user?.hasVideo) return;
    void client.subscribe(user, "video").then(() => {
      if (user.videoTrack) {
        subscribedScreenRef.current = selectedSession;
        setScreenTracks({ [selectedSession]: user.videoTrack });
      }
    }).catch(() => {});
  }, [selectedSession]);

  // 데이터 fetch (refetch)
  useEffect(() => {
    let cancelled = false;
    let pollingId: ReturnType<typeof setInterval> | null = null;
    let refreshId: ReturnType<typeof setTimeout> | null = null;
    let requestInFlight = false;
    let refreshQueued = false;

    const fetchData = async () => {
      if (requestInFlight) {
        refreshQueued = true;
        return;
      }
      requestInFlight = true;
      try {
        const res = await fetch(
          `/api/examiner/monitor?examId=${exam.id}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "조회 실패");
          return;
        }
        setSessions(data.sessions ?? []);
        setEvents(data.events ?? []);
        sessionIdsRef.current = new Set(
          (data.sessions ?? []).map((s: Session) => s.sessionId)
        );
        setLastFetched(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "네트워크 오류");
      } finally {
        requestInFlight = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void fetchData();
        }
      }
    };
    const scheduleFetch = () => {
      if (refreshId) clearTimeout(refreshId);
      refreshId = setTimeout(() => {
        refreshId = null;
        void fetchData();
      }, REALTIME_REFRESH_DELAY_MS);
    };

    void fetchData();
    // Realtime 실패 대비 30초 fallback 폴링
    pollingId = setInterval(fetchData, 30_000);

    // Supabase Realtime 구독
    const supabase = createClientSupabase();
    const channel = supabase
      .channel(`examiner-monitor-${exam.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "monitoring_events",
        },
        (payload) => {
          const sessionId = (payload.new as { session_id?: string })
            ?.session_id;
          if (sessionId && sessionIdsRef.current.has(sessionId)) {
            scheduleFetch();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_sessions",
        },
        (payload) => {
          const sessionId = (payload.new as { id?: string })?.id;
          if (sessionId && sessionIdsRef.current.has(sessionId)) {
            scheduleFetch();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "exam_sessions",
        },
        (payload) => {
          // 새 세션 생성 (응시자 진입) → refetch
          const examId = (payload.new as { exam_id?: string })?.exam_id;
          if (examId === exam.id) scheduleFetch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
        },
        (payload) => {
          const sessionId = (payload.new as { session_id?: string })
            .session_id;
          const senderRole = (payload.new as { sender_role?: string })
            .sender_role;
          if (
            senderRole === "applicant" &&
            sessionId &&
            sessionIdsRef.current.has(sessionId)
          ) {
            scheduleFetch();
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setRealtimeStatus("polling");
      });

    return () => {
      cancelled = true;
      if (pollingId) clearInterval(pollingId);
      if (refreshId) clearTimeout(refreshId);
      void supabase.removeChannel(channel);
    };
  }, [exam.id]);

  useEffect(() => {
    let cancelled = false;
    const leaveCallbacks: Array<() => Promise<void>> = [];
    const screenUsers = screenUsersRef.current;
    const webcamUsers = webcamUsersRef.current;
    const webcamUids = webcamUidRef.current;
    const screenUids = screenUidRef.current;
    const subscribedWebcams = subscribedWebcamsRef.current;

    void (async () => {
      try {
        const AgoraRTC = await import("agora-rtc-sdk-ng").then(
          (module) => module.default
        );
        if (cancelled) return;

        const connect = async (media: "webcam" | "screen") => {
          const response = await fetch("/api/agora/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "examiner",
              examId: exam.id,
              media,
              shard: mediaPage,
            }),
          });
          const config = await response.json();
          if (!response.ok) {
            throw new Error(config.error ?? `Agora ${media} token failed`);
          }
          const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
          if (media === "screen") screenClientRef.current = client;
          else webcamClientRef.current = client;

          const renewToken = () => {
            void (async () => {
              const tokenResponse = await fetch("/api/agora/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mode: "examiner",
                  examId: exam.id,
                  media,
                  shard: mediaPage,
                }),
              });
              const renewed = await tokenResponse.json();
              if (!tokenResponse.ok) {
                throw new Error(`Agora ${media} token renewal failed`);
              }
              await client.renewToken(renewed.token);
            })().catch(() => {
              if (!cancelled) setError(`Agora ${media} 토큰 갱신 실패`);
            });
          };
          const onPublished = async (
            user: IAgoraRTCRemoteUser,
            mediaType: "audio" | "video"
          ) => {
            if (mediaType !== "video") return;
            const uid = String(user.uid);
            const prefix = media === "screen" ? "screen-" : "applicant-";
            if (!uid.startsWith(prefix)) return;
            const sessionId = uid.slice(prefix.length, prefix.length + 36);
            if (media === "screen") {
              screenUsersRef.current.set(sessionId, user);
              screenUidRef.current.set(sessionId, uid);
              if (selectedSessionRef.current !== sessionId) return;
              subscribedScreenRef.current = sessionId;
            } else {
              webcamUsersRef.current.set(sessionId, user);
              webcamUidRef.current.set(sessionId, uid);
              if (!desiredWebcamsRef.current.has(sessionId)) return;
              subscribedWebcamsRef.current.add(sessionId);
            }
            await client.subscribe(user, "video");
            if (user.videoTrack) {
              const setter =
                media === "screen" ? setScreenTracks : setVideoTracks;
              setter((current) => ({
                ...current,
                [sessionId]: user.videoTrack!,
              }));
            }
          };
          const onUnpublished = (user: IAgoraRTCRemoteUser) => {
            const uid = String(user.uid);
            const prefix = media === "screen" ? "screen-" : "applicant-";
            if (!uid.startsWith(prefix)) return;
            const sessionId = uid.slice(prefix.length, prefix.length + 36);
            const activeUid =
              media === "screen"
                ? screenUidRef.current.get(sessionId)
                : webcamUidRef.current.get(sessionId);
            if (activeUid !== uid) return;
            if (media === "screen") {
              screenUsersRef.current.delete(sessionId);
              screenUidRef.current.delete(sessionId);
              if (subscribedScreenRef.current === sessionId) {
                subscribedScreenRef.current = null;
              }
            } else {
              webcamUsersRef.current.delete(sessionId);
              webcamUidRef.current.delete(sessionId);
              subscribedWebcamsRef.current.delete(sessionId);
            }
            const setter =
              media === "screen" ? setScreenTracks : setVideoTracks;
            setter((current) => {
              const next = { ...current };
              next[sessionId]?.stop();
              delete next[sessionId];
              return next;
            });
          };
          client.on("token-privilege-will-expire", renewToken);
          client.on("token-privilege-did-expire", renewToken);
          client.on("user-published", onPublished);
          client.on("user-unpublished", onUnpublished);
          await client.join(
            config.appId,
            config.channel,
            config.token,
            config.uid
          );
          leaveCallbacks.push(async () => {
            client.off("token-privilege-will-expire", renewToken);
            client.off("token-privilege-did-expire", renewToken);
            client.off("user-published", onPublished);
            client.off("user-unpublished", onUnpublished);
            await client.leave().catch(() => {});
          });
        };

        await Promise.all([connect("webcam"), connect("screen")]);
      } catch (joinError) {
        if (!cancelled) {
          setError(
            joinError instanceof Error
              ? `Agora: ${joinError.message}`
              : "Agora 연결 실패"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      webcamClientRef.current = null;
      screenClientRef.current = null;
      screenUsers.clear();
      webcamUsers.clear();
      webcamUids.clear();
      screenUids.clear();
      subscribedWebcams.clear();
      subscribedScreenRef.current = null;
      setVideoTracks((current) => {
        Object.values(current).forEach((track) => track.stop());
        return {};
      });
      setScreenTracks((current) => {
        Object.values(current).forEach((track) => track.stop());
        return {};
      });
      for (const leave of leaveCallbacks) void leave();
    };
  }, [exam.id, mediaPage]);

  const { alerts, normals } = useMemo(() => {
    const alerts: Session[] = [];
    const normals: Session[] = [];
    for (const s of sessions) {
      if (s.highCount > 0 || s.isFlagged) alerts.push(s);
      else normals.push(s);
    }
    alerts.sort((a, b) => b.highCount - a.highCount);
    return { alerts, normals };
  }, [sessions]);
  const pageAlerts = alerts.filter(
    (session) => getAgoraShard(session.sessionId) === mediaPage
  );
  const pageNormals = normals.filter(
    (session) => getAgoraShard(session.sessionId) === mediaPage
  );

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) => severityFilter === "all" || e.severity === severityFilter
      ),
    [events, severityFilter]
  );

  const stats = {
    total: sessions.length,
    active: sessions.filter((s) => s.status === "in_progress").length,
    waiting: sessions.filter((s) => s.status === "waiting").length,
    alerts: alerts.length,
  };
  const selectedApplicant = sessions.find(
    (session) => session.sessionId === selectedSession
  );
  const openApplicant = (sessionId: string) => {
    setMediaPage(getAgoraShard(sessionId));
    setExpandedView("screen");
    setSelectedSession(sessionId);
  };
  const pageSessions = sessions.filter(
    (session) => getAgoraShard(session.sessionId) === mediaPage
  );
  const chatSessions = sessions.filter(
    (session) => session.unreadMessageCount > 0
  ).sort(
    (left, right) =>
      new Date(right.latestUnreadMessage?.createdAt ?? 0).getTime() -
      new Date(left.latestUnreadMessage?.createdAt ?? 0).getTime()
  );
  const unreadChatCount = chatSessions.reduce(
    (total, session) => total + session.unreadMessageCount,
    0
  );
  const handleChatRead = useCallback((sessionId: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.sessionId === sessionId
          ? {
              ...session,
              unreadMessageCount: 0,
              latestUnreadMessage: null,
            }
          : session
      )
    );
  }, []);
  const handleChatLatest = useCallback(
    (sessionId: string, message: ChatMessage) => {
      setSessions((current) =>
        current.map((session) =>
          session.sessionId === sessionId
            ? {
                ...session,
                latestMessage: {
                  senderRole: message.sender_role,
                  content: message.content,
                  createdAt: message.created_at,
                },
              }
            : session
        )
      );
    },
    []
  );
  const previousUnreadChatCount = useRef(0);
  useEffect(() => {
    if (unreadChatCount > previousUnreadChatCount.current) {
      try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.22);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.24);
        oscillator.onended = () => void audio.close();
      } catch {
        // 브라우저 자동재생 정책으로 소리가 막혀도 고정 시각 알림은 유지한다.
      }
    }
    previousUnreadChatCount.current = unreadChatCount;
  }, [unreadChatCount]);

  const sendAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = announcement.trim();
    if (!content || announcementBusy) return;
    setAnnouncementBusy(true);
    setAnnouncementResult(null);
    try {
      const response = await fetch("/api/examiner/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "전체 공지 전송 실패");
      setAnnouncement("");
      setAnnouncementResult(
        data.recipientCount > 0
          ? `${data.recipientCount}명에게 공지를 전송했습니다.`
          : "현재 입장한 응시자가 없습니다."
      );
    } catch (sendError) {
      setAnnouncementResult(
        sendError instanceof Error ? sendError.message : "전체 공지 전송 실패"
      );
    } finally {
      setAnnouncementBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title={exam.title}
        lastFetched={lastFetched}
        durationMinutes={exam.durationMinutes}
        examDate={exam.examDate}
      />

      {unreadChatCount > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed right-6 top-20 z-[120] w-[min(420px,calc(100vw-3rem))] overflow-hidden rounded-md border-2 border-danger bg-white shadow-2xl"
        >
          <div className="flex items-center gap-3 bg-danger px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg animate-pulse">
              💬
            </span>
            <div className="flex-1">
              <div className="font-bold">새 응시자 채팅 {unreadChatCount}건</div>
              <div className="text-xs text-white/80">
                확인할 때까지 이 알림이 계속 표시됩니다.
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {chatSessions.slice(0, 3).map((session) => (
              <Link
                key={session.sessionId}
                href={`/examiner/session/${session.sessionId}`}
                className="block bg-white px-4 py-3 transition hover:bg-danger-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-sm">
                    {session.applicantName}
                  </span>
                  <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                    {session.unreadMessageCount}건
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {session.latestUnreadMessage?.content}
                </div>
              </Link>
            ))}
            {chatSessions.length > 3 && (
              <div className="bg-surface-soft px-4 py-2 text-center text-xs font-bold text-danger">
                그 외 {chatSessions.length - 3}명에게 새 메시지가 있습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {selectedApplicant && (
        <ExpandedMonitor
          applicant={selectedApplicant}
          view={expandedView}
          webcamTrack={videoTracks[selectedApplicant.sessionId]}
          screenTrack={screenTracks[selectedApplicant.sessionId]}
          onViewChange={setExpandedView}
          onClose={() => setSelectedSession(null)}
        />
      )}
      {batchEndOpen && (
        <BatchEndDialog
          examId={exam.id}
          examTitle={exam.title}
          targetCount={stats.active + stats.waiting}
          onClose={() => setBatchEndOpen(false)}
        />
      )}

      <div className="mx-auto max-w-7xl px-6 py-6 flex gap-6">
        <main className="flex-1 min-w-0 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            <StatBig label="Sessions" value={stats.total} tone="primary" />
            <StatBig label="Active" value={stats.active} tone="primary" />
            <StatBig label="Waiting" value={stats.waiting} tone="info" />
            <StatBig label="Alerts" value={stats.alerts} tone="danger" pulse />
          </div>

          {(stats.active > 0 || stats.waiting > 0) && (
            <div className="flex items-center justify-between rounded-md border border-danger/40 bg-white p-4">
              <div>
                <div className="text-xs font-bold text-danger">비상 운영 조치</div>
                <div className="text-xs text-muted-foreground">
                  시스템 장애·문제 오류 시 미제출 응시자 {stats.active + stats.waiting}명을 일괄 종료합니다.
                </div>
              </div>
              <button
                onClick={() => setBatchEndOpen(true)}
                className="h-10 rounded-md bg-danger px-5 text-xs font-bold text-white"
              >
                전체 시험 종료
              </button>
            </div>
          )}

          {unreadChatCount > 0 && (
            <section className="rounded-md border-2 border-danger bg-danger-soft p-4 shadow-lg">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger text-lg text-white animate-pulse">
                  💬
                </span>
                <div>
                  <div className="font-bold text-danger">
                    새 응시자 채팅 {unreadChatCount}건
                  </div>
                  <div className="text-xs text-muted-foreground">
                    응시자 카드를 열면 확인 처리됩니다.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {chatSessions.map((session) => (
                  <Link
                    key={session.sessionId}
                    href={`/examiner/session/${session.sessionId}`}
                    className="rounded-md border border-danger/30 bg-white p-3 transition hover:border-danger"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">
                        {session.applicantName}
                      </span>
                      <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                        {session.unreadMessageCount}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {session.latestUnreadMessage?.content}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <form
            onSubmit={sendAnnouncement}
            className="rounded-md border border-primary bg-primary-soft p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  전체 공지
                </div>
                <div className="text-xs text-muted-foreground">
                  현재 입장한 모든 미제출 응시자에게 즉시 전달됩니다.
                </div>
              </div>
              {announcementResult && (
                <div className="text-xs font-bold text-primary">
                  {announcementResult}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                maxLength={500}
                placeholder="전체 공지 내용을 입력하세요"
                aria-label="전체 공지 내용"
                className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={announcementBusy || !announcement.trim()}
                className="h-10 rounded-md bg-primary px-5 text-xs font-bold text-white disabled:opacity-40"
              >
                {announcementBusy ? "전송 중…" : "모두에게 전송"}
              </button>
            </div>
          </form>

          <div className="rounded-md bg-white border border-border p-4 flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-bold tracking-widest uppercase",
                realtimeStatus === "live"
                  ? "bg-success-soft text-success"
                  : realtimeStatus === "polling"
                  ? "bg-warning-soft text-warning"
                  : "bg-info-soft text-info"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  realtimeStatus === "live"
                    ? "bg-success"
                    : realtimeStatus === "polling"
                    ? "bg-warning"
                    : "bg-info"
                )}
              />
              {realtimeStatus === "live"
                ? "Realtime"
                : realtimeStatus === "polling"
                ? "Polling"
                : "Connecting"}
            </span>
            <div className="text-xs text-muted-foreground flex-1">
              {realtimeStatus === "live"
                ? "Supabase Realtime 구독 중 · 이벤트 발생 즉시 반영"
                : "30초 fallback 폴링 · Realtime 연결 대기"}
            </div>
            {error && (
              <span className="text-[10px] font-bold text-danger">
                {error}
              </span>
            )}
          </div>

          <nav
            aria-label="감독 영상 페이지"
            className="rounded-md border border-border bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold">감독 영상 페이지</div>
                <div className="text-[10px] text-muted-foreground">
                  현재 페이지의 웹캠·화면공유 채널만 연결합니다.
                </div>
              </div>
              <span className="text-xs font-bold text-primary">
                {mediaPage + 1} / {AGORA_SHARD_COUNT} · {pageSessions.length}명
              </span>
            </div>
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: AGORA_SHARD_COUNT }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setSelectedSession(null);
                    setMediaPage(index);
                  }}
                  aria-current={mediaPage === index ? "page" : undefined}
                  className={cn(
                    "h-9 rounded-md border text-xs font-bold transition",
                    mediaPage === index
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-white text-muted-foreground hover:border-primary"
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </nav>

          <Section
            step="01"
            titleKor="주목 필요"
            tag="ALERT"
            subtitle="HIGH severity · is_flagged · 즉각 개입 검토"
            count={pageAlerts.length}
            tone="danger"
          >
            {pageAlerts.length === 0 ? (
              <EmptyRow message="현재 주목이 필요한 응시자가 없습니다." />
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {pageAlerts.map((app) => (
                  <ApplicantCard
                    key={app.sessionId}
                    app={app}
                    size="lg"
                    selected={selectedSession === app.sessionId}
                    onSelect={() => openApplicant(app.sessionId)}
                    videoTrack={videoTracks[app.sessionId]}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            step="02"
            titleKor="정상"
            tag="NORMAL"
            subtitle="관찰 유지 · 존재 확인"
            count={pageNormals.length}
            tone="success"
          >
            {pageNormals.length === 0 ? (
              <EmptyRow message="현재 정상 응시자가 없습니다." />
            ) : (
              <div className="grid grid-cols-10 gap-2">
                {pageNormals.map((app) => (
                  <ApplicantCard
                    key={app.sessionId}
                    app={app}
                    size="sm"
                    selected={selectedSession === app.sessionId}
                    onSelect={() => openApplicant(app.sessionId)}
                    videoTrack={videoTracks[app.sessionId]}
                  />
                ))}
              </div>
            )}
          </Section>
        </main>

        <aside className="w-96 shrink-0">
          <div className="sticky top-24 rounded-md bg-white border border-border overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="grid grid-cols-2 border-b border-border bg-surface-soft">
              <button
                type="button"
                onClick={() => setRightPanel("chat")}
                className={cn(
                  "h-12 text-xs font-bold transition",
                  rightPanel === "chat"
                    ? "border-b-2 border-primary bg-white text-primary"
                    : "text-muted-foreground"
                )}
              >
                채팅 {unreadChatCount > 0 ? `(${unreadChatCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setRightPanel("events")}
                className={cn(
                  "h-12 text-xs font-bold transition",
                  rightPanel === "events"
                    ? "border-b-2 border-primary bg-white text-primary"
                    : "text-muted-foreground"
                )}
              >
                감독 이벤트
              </button>
            </div>

            {rightPanel === "chat" ? (
              <MonitorChatPanel
                sessions={sessions}
                onRead={handleChatRead}
                onLatest={handleChatLatest}
              />
            ) : (
              <>
                <div className="p-4 border-b border-border">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-bold text-sm">실시간 감독 이벤트</div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-danger">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                      LIVE
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(["all", "high", "info"] as SeverityFilter[]).map(
                      (severity) => (
                        <button
                          key={severity}
                          type="button"
                          onClick={() => setSeverityFilter(severity)}
                          className={cn(
                            "h-7 px-3 rounded-sm text-[10px] font-bold tracking-widest transition uppercase",
                            severityFilter === severity
                              ? "bg-primary text-white"
                              : "bg-surface-soft text-muted-foreground hover:bg-subtle"
                          )}
                        >
                          {severity === "all" ? "ALL" : severity}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredEvents.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      onClick={() => openApplicant(event.sessionId)}
                      active={selectedSession === event.sessionId}
                    />
                  ))}
                  {filteredEvents.length === 0 && (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      {events.length === 0
                        ? "아직 감독 이벤트가 없습니다"
                        : "해당 심각도의 이벤트가 없습니다"}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MonitorChatPanel({
  sessions,
  onRead,
  onLatest,
}: {
  sessions: Session[];
  onRead: (sessionId: string) => void;
  onLatest: (sessionId: string, message: ChatMessage) => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedSession = sessions.find(
    (session) => session.sessionId === selectedSessionId
  );
  const orderedSessions = [...sessions].sort((left, right) => {
    if (left.unreadMessageCount !== right.unreadMessageCount) {
      return right.unreadMessageCount - left.unreadMessageCount;
    }
    return (
      new Date(right.latestMessage?.createdAt ?? 0).getTime() -
      new Date(left.latestMessage?.createdAt ?? 0).getTime()
    );
  });

  useEffect(() => {
    if (!selectedSessionId) return;
    let cancelled = false;
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/examiner/session/${selectedSessionId}/messages?t=${Date.now()}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (!cancelled && response.ok) {
          setMessages(data.messages ?? []);
          onRead(selectedSessionId);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchMessages();
    const pollingId = setInterval(fetchMessages, 20_000);
    const supabase = createClientSupabase();
    const channel = supabase
      .channel(`monitor-chat-${selectedSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${selectedSessionId}`,
        },
        () => void fetchMessages()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollingId);
      void supabase.removeChannel(channel);
    };
  }, [onRead, selectedSessionId]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!selectedSessionId || !content || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/examiner/session/${selectedSessionId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const data = await response.json();
      if (response.ok && data.message) {
        const message = data.message as ChatMessage;
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message]
        );
        onLatest(selectedSessionId, message);
        setInput("");
      }
    } finally {
      setBusy(false);
    }
  }

  if (selectedSession) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <button
            type="button"
            onClick={() => setSelectedSessionId(null)}
            aria-label="대화방 목록으로 돌아가기"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-soft"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {selectedSession.applicantName}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {selectedSession.organization}
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-success" />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto bg-[#b2c7d9]/35 p-4">
          {loading && messages.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              대화를 불러오는 중…
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              아직 대화가 없습니다
            </div>
          )}
          {messages.map((message) => {
            const isExaminer = message.sender_role === "examiner";
            return (
              <div
                key={message.id}
                className={cn("flex", isExaminer ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[82%] rounded-xl px-3 py-2 shadow-sm",
                    isExaminer ? "bg-[#fee500] text-black" : "bg-white"
                  )}
                >
                  <div className="break-words text-sm">{message.content}</div>
                  <div className="mt-1 text-right text-[9px] text-black/50">
                    {new Date(message.created_at).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={500}
            disabled={busy}
            placeholder="메시지 입력"
            aria-label="감독관 메시지"
            className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-10 rounded-md bg-primary px-4 text-xs font-bold text-white disabled:opacity-40"
          >
            전송
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-bold">응시자 대화</div>
        <div className="text-[10px] text-muted-foreground">
          안 읽은 메시지가 있는 대화가 위에 표시됩니다.
        </div>
      </div>
      {orderedSessions.map((session) => (
        <button
          key={session.sessionId}
          type="button"
          onClick={() => setSelectedSessionId(session.sessionId)}
          className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-soft"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
            {session.applicantName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold">
                {session.applicantName}
              </span>
              {session.latestMessage && (
                <span className="shrink-0 text-[9px] text-muted">
                  {new Date(session.latestMessage.createdAt).toLocaleTimeString(
                    "ko-KR",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </span>
              )}
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">
                {session.latestMessage?.content ?? "대화를 시작하세요"}
              </span>
              {session.unreadMessageCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {session.unreadMessageCount}
                </span>
              )}
            </span>
          </span>
        </button>
      ))}
      {orderedSessions.length === 0 && (
        <div className="p-8 text-center text-xs text-muted-foreground">
          현재 입장한 응시자가 없습니다.
        </div>
      )}
    </div>
  );
}

function BatchEndDialog({
  examId,
  examTitle,
  targetCount,
  onClose,
}: {
  examId: string;
  examTitle: string;
  targetCount: number;
  onClose: () => void;
}) {
  const [titleConfirmation, setTitleConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const confirmed = titleConfirmation === examTitle && reason.trim().length >= 5;
  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/examiner/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, examTitle: titleConfirmation, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "전체 종료 실패");
      setResult(`${data.submittedCount}명의 답안을 확정하고 시험을 종료했습니다.`);
    } catch (submitError) {
      setResult(submitError instanceof Error ? submitError.message : "전체 종료 실패");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-md border border-danger bg-white p-6 shadow-2xl">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-danger">위험 작업</div>
        <h2 className="text-xl font-bold">전체 시험을 종료하시겠습니까?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          대기·응시 중인 최대 {targetCount}명의 현재 답안을 제출 상태로 확정합니다. 실행 후 되돌릴 수 없습니다.
        </p>
        <label className="mt-5 block space-y-1">
          <span className="text-xs font-bold">시험명 확인</span>
          <div className="text-[11px] text-muted-foreground">아래에 “{examTitle}”을 정확히 입력하세요.</div>
          <input value={titleConfirmation} onChange={(event) => setTitleConfirmation(event.target.value)} disabled={!!result} className="h-10 w-full rounded-md border border-border px-3 text-sm" aria-label="종료할 시험명 확인" />
        </label>
        <label className="mt-4 block space-y-1">
          <span className="text-xs font-bold">종료 사유</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={!!result} maxLength={500} rows={3} placeholder="최소 5자 · 응시자에게도 전달됩니다" className="w-full resize-none rounded-md border border-border p-3 text-sm" />
        </label>
        {result && <div className="mt-4 rounded-md border border-info bg-info-soft p-3 text-sm font-bold text-info">{result}</div>}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy} className="h-11 flex-1 rounded-md border border-border text-sm font-bold disabled:opacity-40">{result ? "닫기" : "취소"}</button>
          {!result && <button onClick={() => void submit()} disabled={!confirmed || busy} className="h-11 flex-1 rounded-md bg-danger text-sm font-bold text-white disabled:opacity-30">{busy ? "종료 처리 중…" : `${targetCount}명 전체 종료`}</button>}
        </div>
      </div>
    </div>
  );
}

function ExpandedMonitor({
  applicant,
  view,
  webcamTrack,
  screenTrack,
  onViewChange,
  onClose,
}: {
  applicant: Session;
  view: "screen" | "webcam";
  webcamTrack?: IRemoteVideoTrack;
  screenTrack?: IRemoteVideoTrack;
  onViewChange: (view: "screen" | "webcam") => void;
  onClose: () => void;
}) {
  const track = view === "screen" ? screenTrack : webcamTrack;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-md border border-white/20 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 px-5 py-4 text-white">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              실시간 확대 감독
            </div>
            <div className="font-bold">
              {applicant.applicantName} · {applicant.organization}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewChange("screen")}
              className={cn(
                "h-9 rounded-md px-4 text-xs font-bold",
                view === "screen"
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white"
              )}
            >
              화면 공유
            </button>
            <button
              onClick={() => onViewChange("webcam")}
              className={cn(
                "h-9 rounded-md px-4 text-xs font-bold",
                view === "webcam"
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white"
              )}
            >
              웹캠
            </button>
            <Link
              href={`/examiner/session/${applicant.sessionId}`}
              className="inline-flex h-9 items-center rounded-md bg-white px-4 text-xs font-bold text-slate-950"
            >
              상세 정보
            </Link>
            <button
              onClick={onClose}
              aria-label="확대 감독 닫기"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-xl text-white"
            >
              ×
            </button>
          </div>
        </div>
        <div className="relative aspect-video min-h-0 flex-1 bg-black">
          {track ? (
            <RemoteVideo track={track} fit={view === "screen" ? "contain" : "cover"} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
              <div className="mb-3 text-4xl">{view === "screen" ? "🖥️" : "📷"}</div>
              <div className="font-bold">
                {view === "screen" ? "화면 공유" : "웹캠"} 연결 대기 중
              </div>
              <div className="mt-1 text-xs">응시자의 스트림이 연결되면 자동으로 표시됩니다.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({
  title,
  lastFetched,
  durationMinutes,
  examDate,
}: {
  title: string;
  lastFetched: Date | null;
  durationMinutes: number;
  examDate: string | null;
}) {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/examiner/monitor" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
              Kbrain Cert · Examiner
            </div>
            <div className="font-bold text-sm truncate max-w-md">{title}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-tabular">
          <Link
            href="/examiner/events"
            className="rounded-md border border-border bg-white px-3 py-1.5 font-bold text-primary"
          >
            이벤트 검토
          </Link>
          {examDate && (
            <span>시험 {new Date(examDate).toLocaleString("ko-KR")}</span>
          )}
          <span>{durationMinutes}분</span>
          {lastFetched && (
            <span>·  갱신 {lastFetched.toLocaleTimeString("ko-KR")}</span>
          )}
        </div>
      </div>
    </nav>
  );
}

function StatBig({
  label,
  value,
  tone,
  pulse = false,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "danger" | "warning" | "info";
  pulse?: boolean;
}) {
  const text = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    info: "text-info",
  }[tone];
  return (
    <div className="rounded-md bg-white border border-border p-4">
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1 uppercase">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div className={cn("font-tabular text-2xl font-bold", text)}>{value}</div>
        {pulse && value > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}

function Section({
  step,
  titleKor,
  tag,
  subtitle,
  count,
  tone,
  children,
}: {
  step: string;
  titleKor: string;
  tag: string;
  subtitle: string;
  count: number;
  tone: "danger" | "warning" | "success";
  children: React.ReactNode;
}) {
  const dotColor = {
    danger: "bg-danger",
    warning: "bg-warning",
    success: "bg-success",
  }[tone];
  const textColor = {
    danger: "text-danger",
    warning: "text-warning",
    success: "text-success",
  }[tone];
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3 flex-wrap pb-2 border-b border-border">
        <span className="font-tabular text-xs font-bold text-primary tabular-nums">
          {step}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold tracking-widest uppercase",
            textColor
          )}
        >
          {tag}
        </span>
        <h2 className="text-lg font-bold">{titleKor}</h2>
        <span className="text-sm font-bold text-muted-foreground tabular-nums">
          {count}명
        </span>
        <span className="text-xs text-muted-foreground">· {subtitle}</span>
        <span className={cn("ml-auto w-2 h-2 rounded-full self-center", dotColor)} />
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ApplicantCard({
  app,
  size,
  selected,
  onSelect,
  videoTrack,
}: {
  app: Session;
  size: "sm" | "md" | "lg";
  selected: boolean;
  onSelect: () => void;
  videoTrack?: IRemoteVideoTrack;
}) {
  const hasHigh = app.highCount > 0 || app.isFlagged;

  const borderClass = selected
    ? "border-primary ring-1 ring-primary-soft"
    : app.unreadMessageCount > 0
    ? "border-danger ring-2 ring-danger/20"
    : hasHigh
    ? "border-danger"
    : "border-border";

  const initial = app.applicantName.slice(0, 2).toUpperCase();
  const lastEventLabel = app.lastEvent
    ? EVENT_LABEL[app.lastEvent.eventType] ?? app.lastEvent.eventType
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "block w-full text-left rounded-md bg-white border overflow-hidden transition hover:shadow-card-hover",
        borderClass
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-black",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square"
        )}
      >
        {app.unreadMessageCount > 0 && (
          <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-danger px-2 py-1 text-[10px] font-bold text-white shadow-md animate-pulse">
            💬 {app.unreadMessageCount}
          </div>
        )}
        {!selected && videoTrack && (
          <RemoteVideo track={videoTrack} />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "font-tabular font-bold text-white/25",
              size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-sm"
            )}
          >
            {(selected || !videoTrack) && initial}
          </div>
        </div>
        {app.highCount > 0 && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 rounded-sm text-white font-bold flex items-center justify-center font-tabular",
              "bg-danger",
              size === "lg"
                ? "text-sm w-6 h-6"
                : size === "md"
                ? "text-xs w-5 h-5"
                : "text-[10px] w-4 h-4"
            )}
          >
            {app.highCount}
          </div>
        )}
        {size === "lg" && lastEventLabel && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm tracking-wider",
              app.lastEvent?.severity === "high"
                ? "bg-danger/85"
                : "bg-black/60"
            )}
          >
            {lastEventLabel}
          </div>
        )}
      </div>

      {size === "sm" ? (
        <div className="px-1.5 py-1.5 text-center">
          <div className="text-[10px] font-bold truncate">
            {app.applicantName}
          </div>
          <div className="text-[9px] font-tabular text-muted">
            {app.status === "in_progress" ? "응시 중" : "대기"}
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between mb-1">
            <div
              className={cn(
                "font-bold truncate",
                size === "lg" ? "text-sm" : "text-xs"
              )}
            >
              {app.applicantName}
            </div>
            <div className="text-[10px] font-tabular text-primary font-bold">
              {app.status}
            </div>
          </div>
          {size === "lg" && (
            <div className="text-[11px] text-muted-foreground truncate mb-2">
              {app.organization} · {app.applicantEmail}
            </div>
          )}
          {size === "md" && (
            <div className="text-[10px] text-muted-foreground truncate mb-2">
              {app.organization}
            </div>
          )}
          <div className="text-[10px] font-tabular text-muted">
            {app.startTime
              ? `시작 ${new Date(app.startTime).toLocaleTimeString("ko-KR")}`
              : "미시작"}
          </div>
        </div>
      )}
    </button>
  );
}

function RemoteVideo({
  track,
  fit = "cover",
}: {
  track: IRemoteVideoTrack;
  fit?: "cover" | "contain";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    track.play(containerRef.current, { fit, mirror: false });
    return () => track.stop();
  }, [fit, track]);
  return <div ref={containerRef} className="absolute inset-0" />;
}

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-danger-soft text-danger",
  warn: "bg-warning-soft text-warning",
  info: "bg-primary-soft text-primary",
};

function EventItem({
  event,
  onClick,
  active,
}: {
  event: MonitorEvent;
  onClick: () => void;
  active: boolean;
}) {
  const label = EVENT_LABEL[event.eventType] ?? event.eventType;
  const style = SEVERITY_STYLE[event.severity] ?? SEVERITY_STYLE.info;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-3 border-b border-border hover:bg-surface-hover transition flex gap-3",
        active && "bg-primary-soft"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-sm flex items-center justify-center text-[9px] font-bold tracking-widest shrink-0 uppercase",
          style
        )}
      >
        {event.severity}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div className="text-sm font-bold truncate">{label}</div>
          <div className="text-[10px] font-tabular text-muted">
            {new Date(event.detectedAt).toLocaleTimeString("ko-KR")}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          <span className="font-bold text-foreground">
            {event.applicantName}
          </span>
          {event.questionIndex != null && ` · Q${event.questionIndex}`}
        </div>
      </div>
    </button>
  );
}
