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
    <div className="flex flex-col min-h-screen">
      <header className="rule-b flex items-center px-8 h-16 gap-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-gold text-base">◆</span>
          <span className="text-[10px] tracking-[0.3em] font-semibold text-primary">
            KBRAIN CERT
          </span>
        </Link>

        <div className="flex-1 flex items-baseline gap-4 pl-8 min-w-0">
          <span className="text-[10px] tracking-[0.35em] text-gold font-semibold">
            EXAMINER · MONITOR
          </span>
          <span className="w-1 h-1 rounded-full bg-[--color-line-strong]" />
          <span className="text-sm text-muted-fg truncate">
            {mockExam.title}
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <Stat label="ENROLLED" value={stats.total} />
          <Divider />
          <Stat label="ACTIVE" value={stats.inProgress} tone="info" />
          <Stat label="SUBMIT" value={stats.submitted} tone="success" />
          <Stat label="ALERTS" value={stats.alerts} tone="danger" />
          <Stat label="WARN" value={stats.warns} tone="warning" />
        </div>

        <div className="pl-6 border-l border-[--color-line]">
          <div className="text-[9px] tracking-[0.3em] text-muted mb-1">
            EXAMINER
          </div>
          <div className="text-sm text-primary font-medium">이명희</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-8 py-8 space-y-12">
          <div className="text-xs text-muted-fg flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[--color-danger] animate-pulse" />
              <span className="tracking-widest font-semibold text-gold">LIVE</span>
            </span>
            <span>·</span>
            <span>
              이벤트 발생 응시자는 자동으로 상단에 확대 배치됩니다. 시선이 문제 응시자로 자연 유도됩니다.
            </span>
          </div>

          <Section
            step="01"
            title="ALERT"
            titleKor="주목 필요"
            subtitle="HIGH severity · stream lost · immediate attention"
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
            title="WARN"
            titleKor="경고"
            subtitle="WARN severity · continued observation"
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
            title="NORMAL"
            titleKor="정상"
            subtitle="INFO or below · presence confirmed"
            count={normals.length}
            tone="muted"
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

        <aside className="w-96 border-l border-[--color-line] flex flex-col">
          <div className="p-6 rule-b">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="text-[10px] tracking-[0.35em] text-gold font-semibold mb-1">
                  EVENT STREAM
                </div>
                <div className="text-sm font-semibold text-primary">
                  실시간 감독 이벤트
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[--color-danger] animate-pulse" />
                <span className="text-[10px] tracking-widest text-muted-fg">
                  LIVE
                </span>
              </div>
            </div>
            <div className="flex gap-1 text-[9px] font-bold tracking-[0.2em]">
              {(["all", "high", "warn", "info"] as SeverityFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={cn(
                    "px-3 h-6 uppercase transition",
                    severityFilter === s
                      ? "bg-gold text-[--color-primary-foreground]"
                      : "text-muted-fg hover:text-primary hover:bg-[--color-surface-hover]"
                  )}
                  style={
                    severityFilter === s
                      ? {
                          backgroundColor: "var(--color-gold)",
                          color: "var(--color-primary-foreground)",
                        }
                      : undefined
                  }
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
              <div className="p-8 text-center text-xs text-muted-fg">
                해당 심각도의 이벤트가 없습니다.
              </div>
            )}
          </div>

          <div className="p-5 rule-t-gold">
            <button className="w-full h-10 bg-gold text-[--color-primary-foreground] text-[10px] tracking-[0.3em] font-bold hover:bg-gold-strong transition"
              style={{
                backgroundColor: "var(--color-gold)",
                color: "var(--color-primary-foreground)",
              }}
            >
              BROADCAST NOTICE
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─────────── 섹션 (Step + Title) ─────────── */

function Section({
  step,
  title,
  titleKor,
  subtitle,
  count,
  tone,
  children,
}: {
  step: string;
  title: string;
  titleKor: string;
  subtitle: string;
  count: number;
  tone: "danger" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const dotColor = {
    danger: "bg-[--color-danger]",
    warning: "bg-[--color-warning]",
    muted: "bg-[--color-line-strong]",
  }[tone];
  const textColor = {
    danger: "text-[--color-danger-strong]",
    warning: "text-[--color-warning]",
    muted: "text-primary",
  }[tone];
  return (
    <section>
      <div className="flex items-baseline gap-6 mb-6 rule-b pb-3">
        <span className="gutter-numeral text-3xl">{step}</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-3 mb-1">
            <h2
              className={cn(
                "text-lg font-serif font-bold tracking-tight",
                textColor
              )}
            >
              {titleKor}
            </h2>
            <span
              className={cn(
                "text-[10px] tracking-[0.35em] font-semibold",
                textColor
              )}
            >
              {title}
            </span>
            <span className="flex-1 h-px" />
            <span className="font-tabular text-xs text-muted-fg">
              {count.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="text-xs text-muted-fg">{subtitle}</div>
        </div>
        <span className={cn("w-2 h-2 rounded-full", dotColor)} />
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-dashed border-[--color-line] py-4 px-6 text-center text-xs text-muted-fg">
      {message}
    </div>
  );
}

/* ─────────── 응시자 카드 (사이즈 3종) ─────────── */

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
  const hasHighAlert = app.lastEvent?.severity === "high" || app.streaming === "disconnected";
  const hasWarn = app.lastEvent?.severity === "warn";

  const borderClass = selected
    ? "ring-1 ring-[--color-gold]"
    : hasHighAlert
    ? "border-l-2 border-[--color-danger]"
    : hasWarn
    ? "border-l-2 border-[--color-warning]"
    : "border-l border-[--color-line]";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left surface-elevated overflow-hidden transition group hover:brightness-125",
        borderClass
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square",
          app.streaming === "disconnected"
            ? "bg-[--color-danger-muted]"
            : "bg-gradient-to-br from-slate-800 via-slate-900 to-black"
        )}
      >
        {app.streaming !== "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/15">
            <svg
              viewBox="0 0 24 24"
              className={cn(
                size === "lg" ? "w-16 h-16" : size === "md" ? "w-10 h-10" : "w-6 h-6"
              )}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <path d="M15 10l6-3v10l-6-3z" />
            </svg>
          </div>
        )}
        {app.streaming === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[--color-danger-strong]">
            <div
              className={cn(
                "font-semibold tracking-[0.3em]",
                size === "sm" ? "text-[8px]" : "text-[10px]"
              )}
            >
              STREAM LOST
            </div>
          </div>
        )}
        <div
          className={cn(
            "absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur",
            size === "sm" ? "px-1 py-0.5" : "px-1.5 py-0.5"
          )}
        >
          {app.recording === "recording" && (
            <>
              <span className="w-1 h-1 rounded-full bg-[--color-danger] animate-pulse" />
              {size !== "sm" && (
                <span className="text-[9px] text-white/80 font-tabular tracking-wider">
                  REC
                </span>
              )}
            </>
          )}
          {app.recording === "error" && size !== "sm" && (
            <span className="text-[9px] text-[--color-warning] font-tabular">ERR</span>
          )}
        </div>
        {app.warningCount > 0 && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 bg-[--color-danger] text-white font-bold flex items-center justify-center font-tabular",
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
              "absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm tracking-wider",
              app.lastEvent.severity === "high"
                ? "bg-[--color-danger]/85"
                : app.lastEvent.severity === "warn"
                ? "bg-[--color-warning]/85"
                : "bg-black/60"
            )}
          >
            {app.lastEvent.label}
          </div>
        )}
      </div>

      {size === "sm" ? (
        <div className="px-1.5 py-1.5 text-center">
          <div className="text-[10px] font-medium text-primary truncate">
            {app.applicant.name}
          </div>
          <div className="text-[9px] font-tabular text-muted-fg">
            {app.progress}%
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between mb-1">
            <div
              className={cn(
                "font-medium text-primary truncate",
                size === "lg" ? "text-sm" : "text-xs"
              )}
            >
              {app.applicant.name}
            </div>
            <div className="text-[10px] font-tabular text-gold">
              Q{app.currentQuestion}
            </div>
          </div>
          {size === "lg" && (
            <div className="text-[11px] text-muted-fg truncate mb-3">
              {app.applicant.organization} · {app.applicant.email}
            </div>
          )}
          {size === "md" && (
            <div className="text-[10px] text-muted-fg truncate mb-2">
              {app.applicant.organization}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-[--color-line-strong] relative overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 h-full",
                  hasHighAlert
                    ? "bg-[--color-danger]"
                    : hasWarn
                    ? "bg-[--color-warning]"
                    : "bg-gold"
                )}
                style={{
                  width: `${app.progress}%`,
                  backgroundColor: hasHighAlert
                    ? "var(--color-danger)"
                    : hasWarn
                    ? "var(--color-warning)"
                    : "var(--color-gold)",
                }}
              />
            </div>
            <div className="text-[10px] font-tabular text-muted-fg">
              {app.progress}%
            </div>
          </div>
          {size === "lg" && (
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 h-8 bg-gold text-[--color-primary-foreground] text-[10px] tracking-[0.25em] font-bold hover:bg-gold-strong transition"
                style={{
                  backgroundColor: "var(--color-gold)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                CHAT
              </button>
              <button className="flex-1 h-8 border border-[--color-line-strong] text-[10px] tracking-[0.25em] font-bold text-primary hover:border-gold hover:text-gold transition">
                DETAIL
              </button>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/* ─────────── 이벤트 아이템 ─────────── */

function EventItem({
  event,
  onClick,
  active,
}: {
  event: ProctoringEvent;
  onClick: () => void;
  active: boolean;
}) {
  const severityColor = {
    high: "bg-[--color-danger]",
    warn: "bg-[--color-warning]",
    info: "bg-[--color-info]",
  }[event.severity];
  const severityText = {
    high: "text-[--color-danger-strong]",
    warn: "text-[--color-warning]",
    info: "text-[--color-info]",
  }[event.severity];

  const eventLabel = {
    face_missing: "얼굴 미검출",
    multiple_faces: "복수 인원 감지",
    voice_detected: "음성 감지",
    fullscreen_exit: "전체화면 이탈",
    tab_switch: "탭 전환",
    recording_error: "녹화 오류",
  }[event.type];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-4 rule-b hover:surface-hover transition flex gap-3",
        active && "bg-gold-muted"
      )}
    >
      <div className={cn("w-0.5 rounded-full self-stretch", severityColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div className="text-xs font-semibold text-primary truncate">
            {eventLabel}
          </div>
          <div className="text-[10px] font-tabular text-muted-fg">
            {event.occurredAt}
          </div>
        </div>
        <div className="text-[11px] text-muted-fg truncate">
          <span className="text-primary/70">{event.applicantName}</span> · Q
          {event.questionIndex}{" "}
          <span
            className={cn(
              "uppercase font-bold ml-1 tracking-widest",
              severityText
            )}
          >
            {event.severity}
          </span>
        </div>
        {event.note && (
          <div className="text-[10px] text-muted-fg mt-0.5 italic">
            {event.note}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─────────── 통계 ─────────── */

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "info" | "success" | "danger" | "warning";
}) {
  const color = {
    muted: "text-primary",
    info: "text-[--color-info]",
    success: "text-[--color-success]",
    danger: "text-[--color-danger-strong]",
    warning: "text-[--color-warning]",
  }[tone];
  return (
    <div className="flex flex-col items-end">
      <span className="text-[9px] text-muted-fg tracking-[0.3em]">{label}</span>
      <span className={cn("font-tabular font-bold text-sm", color)}>
        {value.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-6 bg-[--color-line]" />;
}
