"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClientSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
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
  warnCount: number;
  lastEvent: {
    eventType: string;
    severity: string;
    detectedAt: string;
  } | null;
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

type SeverityFilter = "all" | "high" | "warn" | "info";

export function MonitorLive({
  exam,
}: {
  exam: { id: string; title: string; durationMinutes: number; examDate: string | null };
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "live" | "polling"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [videoTracks, setVideoTracks] = useState<
    Record<string, IRemoteVideoTrack>
  >({});
  const sessionIdsRef = useRef<Set<string>>(new Set());

  // 데이터 fetch (refetch)
  useEffect(() => {
    let cancelled = false;
    let pollingId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
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
      }
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
            void fetchData();
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
            void fetchData();
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
          if (examId === exam.id) void fetchData();
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
      void supabase.removeChannel(channel);
    };
  }, [exam.id]);

  useEffect(() => {
    let cancelled = false;
    let leave: (() => Promise<void>) | undefined;

    void (async () => {
      try {
        const [AgoraRTC, response] = await Promise.all([
          import("agora-rtc-sdk-ng").then((module) => module.default),
          fetch("/api/agora/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "examiner", examId: exam.id }),
          }),
        ]);
        const config = await response.json();
        if (!response.ok) throw new Error(config.error ?? "Agora token failed");
        if (cancelled) return;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        const onPublished = async (
          user: IAgoraRTCRemoteUser,
          mediaType: "audio" | "video"
        ) => {
          if (mediaType !== "video") return;
          await client.subscribe(user, "video");
          const uid = String(user.uid);
          const sessionId = uid.startsWith("applicant-")
            ? uid.slice("applicant-".length)
            : null;
          if (sessionId && user.videoTrack) {
            setVideoTracks((current) => ({
              ...current,
              [sessionId]: user.videoTrack!,
            }));
          }
        };
        const onUnpublished = (user: IAgoraRTCRemoteUser) => {
          const uid = String(user.uid);
          const sessionId = uid.startsWith("applicant-")
            ? uid.slice("applicant-".length)
            : null;
          if (!sessionId) return;
          setVideoTracks((current) => {
            const next = { ...current };
            next[sessionId]?.stop();
            delete next[sessionId];
            return next;
          });
        };
        client.on("user-published", onPublished);
        client.on("user-unpublished", onUnpublished);
        await client.join(config.appId, config.channel, config.token, config.uid);
        leave = async () => {
          client.off("user-published", onPublished);
          client.off("user-unpublished", onUnpublished);
          await client.leave().catch(() => {});
        };
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
      setVideoTracks((current) => {
        Object.values(current).forEach((track) => track.stop());
        return {};
      });
      if (leave) void leave();
    };
  }, [exam.id]);

  const { alerts, warns, normals } = useMemo(() => {
    const alerts: Session[] = [];
    const warns: Session[] = [];
    const normals: Session[] = [];
    for (const s of sessions) {
      if (s.highCount > 0 || s.isFlagged) alerts.push(s);
      else if (s.warnCount > 0) warns.push(s);
      else normals.push(s);
    }
    alerts.sort((a, b) => b.highCount - a.highCount);
    warns.sort((a, b) => b.warnCount - a.warnCount);
    return { alerts, warns, normals };
  }, [sessions]);

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
    warns: warns.length,
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title={exam.title}
        lastFetched={lastFetched}
        durationMinutes={exam.durationMinutes}
        examDate={exam.examDate}
      />

      <div className="mx-auto max-w-7xl px-6 py-6 flex gap-6">
        <main className="flex-1 min-w-0 space-y-6">
          <div className="grid grid-cols-5 gap-3">
            <StatBig label="Sessions" value={stats.total} tone="primary" />
            <StatBig label="Active" value={stats.active} tone="primary" />
            <StatBig label="Waiting" value={stats.waiting} tone="info" />
            <StatBig label="Alerts" value={stats.alerts} tone="danger" pulse />
            <StatBig label="Warn" value={stats.warns} tone="warning" />
          </div>

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

          <Section
            step="01"
            titleKor="주목 필요"
            tag="ALERT"
            subtitle="HIGH severity · is_flagged · 즉각 개입 검토"
            count={alerts.length}
            tone="danger"
          >
            {alerts.length === 0 ? (
              <EmptyRow message="현재 주목이 필요한 응시자가 없습니다." />
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {alerts.map((app) => (
                  <ApplicantCard
                    key={app.sessionId}
                    app={app}
                    size="lg"
                    selected={selectedSession === app.sessionId}
                    onSelect={() => setSelectedSession(app.sessionId)}
                    videoTrack={videoTracks[app.sessionId]}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            step="02"
            titleKor="경고"
            tag="WARN"
            subtitle="WARN severity · 관찰 유지"
            count={warns.length}
            tone="warning"
          >
            {warns.length === 0 ? (
              <EmptyRow message="현재 경고 응시자가 없습니다." />
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {warns.map((app) => (
                  <ApplicantCard
                    key={app.sessionId}
                    app={app}
                    size="md"
                    selected={selectedSession === app.sessionId}
                    onSelect={() => setSelectedSession(app.sessionId)}
                    videoTrack={videoTracks[app.sessionId]}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            step="03"
            titleKor="정상"
            tag="NORMAL"
            subtitle="INFO 이하 · 존재 확인"
            count={normals.length}
            tone="success"
          >
            {normals.length === 0 ? (
              <EmptyRow message="현재 정상 응시자가 없습니다." />
            ) : (
              <div className="grid grid-cols-10 gap-2">
                {normals.map((app) => (
                  <ApplicantCard
                    key={app.sessionId}
                    app={app}
                    size="sm"
                    selected={selectedSession === app.sessionId}
                    onSelect={() => setSelectedSession(app.sessionId)}
                    videoTrack={videoTracks[app.sessionId]}
                  />
                ))}
              </div>
            )}
          </Section>
        </main>

        <aside className="w-96 shrink-0">
          <div className="sticky top-24 rounded-md bg-white border border-border overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="p-5 border-b border-border">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.25em] text-muted uppercase mb-1">
                    Event Stream
                  </div>
                  <div className="font-bold text-base">실시간 감독 이벤트</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-sm bg-danger-soft text-danger px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex gap-1">
                {(["all", "high", "warn", "info"] as SeverityFilter[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setSeverityFilter(s)}
                      className={cn(
                        "px-3 h-7 rounded-sm text-[10px] font-bold tracking-widest transition uppercase",
                        severityFilter === s
                          ? "bg-primary text-white"
                          : "bg-surface-soft text-muted-foreground hover:bg-subtle"
                      )}
                    >
                      {s === "all" ? "ALL" : s}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredEvents.map((e) => (
                <EventItem
                  key={e.id}
                  event={e}
                  onClick={() => setSelectedSession(e.sessionId)}
                  active={selectedSession === e.sessionId}
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
          </div>
        </aside>
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
  const hasWarn = !hasHigh && app.warnCount > 0;

  const borderClass = selected
    ? "border-primary ring-1 ring-primary-soft"
    : hasHigh
    ? "border-danger"
    : hasWarn
    ? "border-warning"
    : "border-border";

  const initial = app.applicantName.slice(0, 2).toUpperCase();
  const lastEventLabel = app.lastEvent
    ? EVENT_LABEL[app.lastEvent.eventType] ?? app.lastEvent.eventType
    : null;

  return (
    <Link
      href={`/examiner/session/${app.sessionId}`}
      onClick={onSelect}
      className={cn(
        "block text-left rounded-md bg-white border overflow-hidden transition hover:shadow-card-hover",
        borderClass
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-black",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square"
        )}
      >
        {videoTrack && <RemoteVideo track={videoTrack} />}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "font-tabular font-bold text-white/25",
              size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-sm"
            )}
          >
            {!videoTrack && initial}
          </div>
        </div>
        {(app.highCount + app.warnCount) > 0 && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 rounded-sm text-white font-bold flex items-center justify-center font-tabular",
              hasHigh ? "bg-danger" : "bg-warning",
              size === "lg"
                ? "text-sm w-6 h-6"
                : size === "md"
                ? "text-xs w-5 h-5"
                : "text-[10px] w-4 h-4"
            )}
          >
            {app.highCount + app.warnCount}
          </div>
        )}
        {size === "lg" && lastEventLabel && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm tracking-wider",
              app.lastEvent?.severity === "high"
                ? "bg-danger/85"
                : app.lastEvent?.severity === "warn"
                ? "bg-warning/85"
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
    </Link>
  );
}

function RemoteVideo({ track }: { track: IRemoteVideoTrack }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    track.play(containerRef.current, { fit: "cover", mirror: false });
    return () => track.stop();
  }, [track]);
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
