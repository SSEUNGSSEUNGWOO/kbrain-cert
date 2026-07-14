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
            <StatBig label="Enrolled" value={stats.total} tone="primary" />
            <StatBig label="Active" value={stats.inProgress} tone="primary" />
            <StatBig label="Submitted" value={stats.submitted} tone="success" />
            <StatBig label="Alerts" value={stats.alerts} tone="danger" pulse />
            <StatBig label="Warn" value={stats.warns} tone="warning" />
          </div>

          <div className="rounded-md bg-white border border-border p-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-danger-soft text-danger px-2 py-1 text-[10px] font-bold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              Live
            </span>
            <div className="text-sm text-muted-foreground">
              이벤트 발생 응시자는 자동으로 상단에 확대 배치됩니다. 시선이 문제 응시자로 자연 유도됩니다.
            </div>
          </div>

          <Section
            step="01"
            titleKor="주목 필요"
            tag="ALERT"
            subtitle="HIGH severity · 스트림 오류 · 즉각 개입 검토"
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
                {(["all", "high", "warn", "info"] as SeverityFilter[]).map((s) => (
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
                <div className="p-8 text-center text-xs text-muted-foreground">
                  해당 심각도의 이벤트가 없습니다.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <button className="w-full h-10 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold transition">
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
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
              Examiner
            </div>
            <div className="font-bold text-sm">이명희</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center text-xs font-bold">
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
  tone,
  pulse = false,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "danger" | "warning";
  pulse?: boolean;
}) {
  const text = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
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
        <span className={cn("text-[10px] font-bold tracking-widest uppercase", textColor)}>
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
}: {
  app: MonitorApplicant;
  size: "sm" | "md" | "lg";
  selected: boolean;
  onSelect: () => void;
}) {
  const hasHighAlert =
    app.lastEvent?.severity === "high" || app.streaming === "disconnected";
  const hasWarn = app.lastEvent?.severity === "warn";

  const borderClass = selected
    ? "border-primary ring-1 ring-primary-soft"
    : hasHighAlert
    ? "border-danger"
    : hasWarn
    ? "border-warning"
    : "border-border";

  const initial = app.applicant.name.slice(-2);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-md bg-white border overflow-hidden transition hover:shadow-card-hover",
        borderClass
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square",
          app.streaming === "disconnected"
            ? "bg-danger-soft"
            : "bg-gradient-to-br from-slate-700 via-slate-800 to-black"
        )}
      >
        {app.streaming !== "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "font-tabular font-bold text-white/25",
                size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-sm"
              )}
            >
              {initial}
            </div>
          </div>
        )}
        {app.streaming === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-danger">
            <div className={cn("font-bold tracking-widest uppercase", size === "sm" ? "text-[8px]" : "text-[10px]")}>
              Lost
            </div>
          </div>
        )}
        {app.recording === "recording" && (
          <div
            className={cn(
              "absolute top-1.5 left-1.5 flex items-center gap-1 rounded-sm bg-black/60 backdrop-blur",
              size === "sm" ? "px-1 py-0.5" : "px-1.5 py-0.5"
            )}
          >
            <span className="w-1 h-1 rounded-full bg-danger animate-pulse" />
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
              "absolute top-1.5 right-1.5 rounded-sm bg-danger text-white font-bold flex items-center justify-center font-tabular",
              size === "lg"
                ? "text-sm w-6 h-6"
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
              "absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm tracking-wider",
              app.lastEvent.severity === "high"
                ? "bg-danger/85"
                : app.lastEvent.severity === "warn"
                ? "bg-warning/85"
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
          <div className="text-[9px] font-tabular text-muted">
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
            <div className="text-[10px] font-tabular text-primary font-bold">
              Q{app.currentQuestion}
            </div>
          </div>
          {size === "lg" && (
            <div className="text-[11px] text-muted-foreground truncate mb-3">
              {app.applicant.organization} · {app.applicant.email}
            </div>
          )}
          {size === "md" && (
            <div className="text-[10px] text-muted-foreground truncate mb-2">
              {app.applicant.organization}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-subtle rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full",
                  hasHighAlert
                    ? "bg-danger"
                    : hasWarn
                    ? "bg-warning"
                    : "bg-primary"
                )}
                style={{ width: `${app.progress}%` }}
              />
            </div>
            <div className="text-[10px] font-tabular text-muted">
              {app.progress}%
            </div>
          </div>
          {size === "lg" && (
            <div className="mt-3 flex gap-2">
              <button className="flex-1 h-8 rounded-sm bg-primary hover:bg-primary-hover text-white text-[10px] font-bold tracking-widest uppercase">
                Chat
              </button>
              <button className="flex-1 h-8 rounded-sm bg-surface-soft hover:bg-subtle text-foreground text-[10px] font-bold tracking-widest uppercase">
                Detail
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
const EVENT_CODE: Record<ProctoringEvent["type"], string> = {
  face_missing: "FM",
  multiple_faces: "MF",
  voice_detected: "VD",
  fullscreen_exit: "FE",
  tab_switch: "TS",
  recording_error: "RE",
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
    high: "bg-danger-soft text-danger",
    warn: "bg-warning-soft text-warning",
    info: "bg-primary-soft text-primary",
  }[event.severity];

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
          "w-9 h-9 rounded-sm flex items-center justify-center text-[10px] font-bold tracking-widest shrink-0",
          severityStyle
        )}
      >
        {EVENT_CODE[event.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div className="text-sm font-bold truncate">
            {EVENT_LABEL[event.type]}
          </div>
          <div className="text-[10px] font-tabular text-muted">
            {event.occurredAt}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          <span className="font-bold text-foreground">
            {event.applicantName}
          </span>{" "}
          · Q{event.questionIndex}
        </div>
        {event.note && (
          <div className="text-[10px] text-muted italic mt-0.5">
            {event.note}
          </div>
        )}
      </div>
    </button>
  );
}
