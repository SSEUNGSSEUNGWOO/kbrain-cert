"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  mockExam,
  mockMonitorApplicants,
  mockRecentEvents,
  type MonitorApplicant,
  type ProctoringEvent,
} from "@/lib/mock";
import { cn } from "@/lib/utils";

type SeverityFilter = "all" | "high" | "warn" | "info";
type Tier = "alert" | "warn" | "normal";

function classifyTier(a: MonitorApplicant): Tier {
  if (a.streaming === "disconnected") return "alert";
  if (a.lastEvent?.severity === "high") return "alert";
  if (a.lastEvent?.severity === "warn") return "warn";
  return "normal";
}

export default function ExaminerMonitorPage() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const filteredEvents = mockRecentEvents.filter(
    (e) => severityFilter === "all" || e.severity === severityFilter
  );

  const { alerts, warns, normals } = useMemo(() => {
    const alerts: MonitorApplicant[] = [];
    const warns: MonitorApplicant[] = [];
    const normals: MonitorApplicant[] = [];
    for (const a of mockMonitorApplicants) {
      const tier = classifyTier(a);
      if (tier === "alert") alerts.push(a);
      else if (tier === "warn") warns.push(a);
      else normals.push(a);
    }
    const byWarn = (a: MonitorApplicant, b: MonitorApplicant) =>
      b.warningCount - a.warningCount;
    alerts.sort(byWarn);
    warns.sort(byWarn);
    return { alerts, warns, normals };
  }, []);

  const stats = {
    total: mockMonitorApplicants.length,
    inProgress: mockMonitorApplicants.filter((a) => a.progress < 100).length,
    submitted: 3,
    alerts: alerts.length,
    warns: warns.length,
  };

  return (
    <div className="min-h-screen">
      <TopBar title={mockExam.title} />

      <div className="mx-auto max-w-7xl px-6 py-6 flex gap-6">
        <main className="flex-1 min-w-0 space-y-6">
          <div className="grid grid-cols-5 gap-3">
            <StatBig label="응시 진행" value={stats.total} unit="명" tone="blue" />
            <StatBig label="제출 완료" value={stats.submitted} unit="명" tone="emerald" />
            <StatBig label="주목 필요" value={stats.alerts} unit="명" tone="red" pulse />
            <StatBig label="경고" value={stats.warns} unit="명" tone="orange" />
            <StatBig
              label="정상"
              value={mockMonitorApplicants.length - stats.alerts - stats.warns}
              unit="명"
              tone="purple"
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[--color-red-soft] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-[--color-red] animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold">
                실시간 감독 중 · 이벤트 발생 응시자는 자동 상단 배치
              </div>
              <div className="text-xs text-[--color-muted-foreground]">
                시선이 문제 응시자로 자연 유도됩니다
              </div>
            </div>
          </div>

          <Section
            step="1"
            titleKor="주목 필요"
            tag="ALERT"
            subtitle="HIGH severity · 스트림 오류 · 즉각 개입 검토"
            count={alerts.length}
            tone="red"
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
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            step="2"
            titleKor="경고"
            tag="WARN"
            subtitle="WARN severity · 관찰 유지"
            count={warns.length}
            tone="orange"
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
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            step="3"
            titleKor="정상"
            tag="NORMAL"
            subtitle="INFO 이하 · 존재 확인"
            count={normals.length}
            tone="emerald"
          >
            <div className="grid grid-cols-10 gap-2">
              {normals.map((app) => (
                <ApplicantCard
                  key={app.sessionId}
                  app={app}
                  size="sm"
                  selected={selectedSession === app.sessionId}
                  onSelect={() => setSelectedSession(app.sessionId)}
                />
              ))}
            </div>
          </Section>
        </main>

        <aside className="w-96 shrink-0">
          <div className="sticky top-24 rounded-3xl bg-white shadow-[var(--shadow-card)] overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="p-5 border-b border-[--color-border]">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-[--color-muted]">
                    이벤트 스트림
                  </div>
                  <div className="font-bold text-base">실시간 감독 이벤트</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[--color-red-soft] text-[--color-red] px-2 py-0.5 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[--color-red] animate-pulse" />
                  LIVE
                </span>
              </div>
              <div className="flex gap-1">
                {(["all", "high", "warn", "info"] as SeverityFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={cn(
                      "px-3 h-7 rounded-lg text-[11px] font-bold tracking-wide transition uppercase",
                      severityFilter === s
                        ? "bg-[--color-primary] text-white"
                        : "bg-[--color-surface-soft] text-[--color-muted-foreground] hover:bg-[--color-subtle]"
                    )}
                  >
                    {s === "all" ? "전체" : s}
                  </button>
                ))}
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
                <div className="p-8 text-center text-xs text-[--color-muted-foreground]">
                  해당 심각도의 이벤트가 없습니다.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[--color-border]">
              <button className="w-full h-11 rounded-2xl bg-[--color-primary] hover:bg-[--color-primary-hover] text-white text-sm font-bold shadow-[var(--shadow-card)] transition">
                전체 응시자에 공지 발송
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-[--color-border]">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[--color-primary] text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-muted]">
              KBRAIN CERT · 감독관
            </div>
            <div className="font-bold text-sm truncate max-w-md">{title}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-muted]">
              감독관
            </div>
            <div className="font-bold text-sm">이명희</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[--color-teal] to-[--color-primary] text-white flex items-center justify-center text-xs font-bold">
            LMH
          </div>
        </div>
      </div>
    </nav>
  );
}

function StatBig({
  label,
  value,
  unit,
  tone,
  pulse = false,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "blue" | "emerald" | "red" | "orange" | "purple";
  pulse?: boolean;
}) {
  const text = {
    blue: "text-[--color-primary]",
    emerald: "text-[--color-emerald]",
    red: "text-[--color-red]",
    orange: "text-[--color-orange]",
    purple: "text-[--color-purple]",
  }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="text-xs font-bold text-[--color-muted-foreground] mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div className={cn("font-tabular text-2xl font-bold", text)}>{value}</div>
        <div className="text-sm font-bold text-[--color-muted]">{unit}</div>
        {pulse && value > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-[--color-red] animate-pulse ml-1" />
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
  tone: "red" | "orange" | "emerald";
  children: React.ReactNode;
}) {
  const badge = {
    red: "bg-[--color-red-soft] text-[--color-red]",
    orange: "bg-[--color-orange-soft] text-[--color-orange]",
    emerald: "bg-[--color-emerald-soft] text-[--color-emerald]",
  }[tone];
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-[--color-foreground] text-white flex items-center justify-center text-sm font-bold tabular-nums">
          {step}
        </div>
        <span className={cn("text-[11px] font-bold tracking-wider px-2 py-1 rounded-md", badge)}>
          {tag}
        </span>
        <h2 className="text-xl font-bold">{titleKor}</h2>
        <span className="text-sm font-bold text-[--color-muted] tabular-nums">
          {count}명
        </span>
        <span className="text-xs text-[--color-muted-foreground]">· {subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-[--color-emerald-soft] py-6 text-center">
      <div className="text-2xl mb-1">🎉</div>
      <div className="text-sm font-semibold text-[--color-emerald]">{message}</div>
    </div>
  );
}

function ApplicantCard({
  app,
  size,
  selected,
  onSelect,
}: {
  app: MonitorApplicant;
  size: "sm" | "md" | "lg";
  selected: boolean;
  onSelect: () => void;
}) {
  const hasHighAlert =
    app.lastEvent?.severity === "high" || app.streaming === "disconnected";
  const hasWarn = app.lastEvent?.severity === "warn";

  const ringClass = selected
    ? "ring-4 ring-[--color-primary-soft]"
    : hasHighAlert
    ? "ring-2 ring-[--color-red]"
    : hasWarn
    ? "ring-2 ring-[--color-orange]"
    : "";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-2xl bg-white shadow-[var(--shadow-card)] overflow-hidden transition hover:shadow-[var(--shadow-card-hover)]",
        ringClass
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square",
          app.streaming === "disconnected"
            ? "bg-[--color-red-soft]"
            : "bg-gradient-to-br from-slate-700 via-slate-800 to-black"
        )}
      >
        {app.streaming !== "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/25">
            <div
              className={cn(
                size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-lg"
              )}
            >
              👤
            </div>
          </div>
        )}
        {app.streaming === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[--color-red]">
            <div className="text-xl">⚠</div>
            {size !== "sm" && (
              <div className="text-[10px] font-bold tracking-widest mt-0.5">
                STREAM LOST
              </div>
            )}
          </div>
        )}
        {app.recording === "recording" && (
          <div
            className={cn(
              "absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur px-1.5",
              size === "sm" ? "py-0.5" : "py-1"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[--color-red] animate-pulse" />
            {size !== "sm" && (
              <span className="text-[9px] text-white font-bold tracking-wider">
                REC
              </span>
            )}
          </div>
        )}
        {app.warningCount > 0 && (
          <div
            className={cn(
              "absolute top-2 right-2 rounded-md bg-[--color-red] text-white font-bold flex items-center justify-center font-tabular",
              size === "lg"
                ? "text-sm w-7 h-7"
                : size === "md"
                ? "text-xs w-5 h-5"
                : "text-[10px] w-4 h-4"
            )}
          >
            {app.warningCount}
          </div>
        )}
        {size === "lg" && app.lastEvent && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm",
              app.lastEvent.severity === "high"
                ? "bg-[--color-red]/85"
                : app.lastEvent.severity === "warn"
                ? "bg-[--color-orange]/85"
                : "bg-black/60"
            )}
          >
            {app.lastEvent.label}
          </div>
        )}
      </div>

      {size === "sm" ? (
        <div className="px-1.5 py-1.5 text-center">
          <div className="text-[10px] font-bold truncate">
            {app.applicant.name}
          </div>
          <div className="text-[9px] font-tabular text-[--color-muted]">
            {app.progress}%
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
              {app.applicant.name}
            </div>
            <div className="text-[10px] font-tabular text-[--color-primary] font-bold">
              Q{app.currentQuestion}
            </div>
          </div>
          {size === "lg" && (
            <div className="text-[11px] text-[--color-muted-foreground] truncate mb-3">
              {app.applicant.organization} · {app.applicant.email}
            </div>
          )}
          {size === "md" && (
            <div className="text-[10px] text-[--color-muted-foreground] truncate mb-2">
              {app.applicant.organization}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[--color-subtle] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  hasHighAlert
                    ? "bg-[--color-red]"
                    : hasWarn
                    ? "bg-[--color-orange]"
                    : "bg-[--color-primary]"
                )}
                style={{ width: `${app.progress}%` }}
              />
            </div>
            <div className="text-[10px] font-tabular text-[--color-muted]">
              {app.progress}%
            </div>
          </div>
          {size === "lg" && (
            <div className="mt-3 flex gap-2">
              <button className="flex-1 h-9 rounded-xl bg-[--color-primary] hover:bg-[--color-primary-hover] text-white text-xs font-bold">
                채팅
              </button>
              <button className="flex-1 h-9 rounded-xl bg-[--color-surface-soft] hover:bg-[--color-subtle] text-[--color-foreground] text-xs font-bold">
                상세 열기
              </button>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

const EVENT_LABEL: Record<ProctoringEvent["type"], string> = {
  face_missing: "얼굴 미검출",
  multiple_faces: "복수 인원 감지",
  voice_detected: "음성 감지",
  fullscreen_exit: "전체화면 이탈",
  tab_switch: "탭 전환",
  recording_error: "녹화 오류",
};
const EVENT_ICON: Record<ProctoringEvent["type"], string> = {
  face_missing: "👁",
  multiple_faces: "👥",
  voice_detected: "🎤",
  fullscreen_exit: "🖥",
  tab_switch: "↗",
  recording_error: "🔴",
};

function EventItem({
  event,
  onClick,
  active,
}: {
  event: ProctoringEvent;
  onClick: () => void;
  active: boolean;
}) {
  const severityStyle = {
    high: "bg-[--color-red-soft] text-[--color-red]",
    warn: "bg-[--color-orange-soft] text-[--color-orange]",
    info: "bg-[--color-primary-soft] text-[--color-primary]",
  }[event.severity];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-3 border-b border-[--color-border] hover:bg-[--color-surface-hover] transition flex gap-3",
        active && "bg-[--color-primary-soft]"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0",
          severityStyle
        )}
      >
        {EVENT_ICON[event.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div className="text-sm font-bold truncate">
            {EVENT_LABEL[event.type]}
          </div>
          <div className="text-[10px] font-tabular text-[--color-muted]">
            {event.occurredAt}
          </div>
        </div>
        <div className="text-[11px] text-[--color-muted-foreground] truncate">
          <span className="font-bold text-[--color-foreground]">
            {event.applicantName}
          </span>{" "}
          · Q{event.questionIndex}
        </div>
        {event.note && (
          <div className="text-[10px] text-[--color-muted] italic mt-0.5">
            {event.note}
          </div>
        )}
      </div>
    </button>
  );
}
