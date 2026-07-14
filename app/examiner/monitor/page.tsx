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
    // 각 티어 내에서 warningCount 내림차순
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
    disconnected: mockMonitorApplicants.filter(
      (a) => a.streaming === "disconnected"
    ).length,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-strong bg-white flex items-center px-6 h-14 gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-semibold tracking-widest text-muted-fg hover:text-primary"
          >
            kbrain-cert
          </Link>
          <span className="text-muted">|</span>
          <span className="text-sm font-medium text-primary">감독관 대시보드</span>
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="text-xs font-semibold tracking-widest text-muted-fg">
            현재 시험
          </div>
          <select className="text-sm font-medium bg-white border border-[--color-border] rounded-sm px-2 h-8 text-primary">
            <option>{mockExam.title}</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Stat label="응시" value={stats.total} />
          <Divider />
          <Stat label="진행중" value={stats.inProgress} tone="info" />
          <Stat label="제출" value={stats.submitted} tone="success" />
          <Stat label="주목필요" value={stats.alerts} tone="danger" />
          <Stat label="경고" value={stats.warns} tone="warning" />
        </div>

        <div className="text-sm text-primary font-medium">감독관 · 이명희</div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto surface-muted p-6 space-y-8">
          <div className="text-xs text-muted-fg mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[--color-danger] animate-pulse" />
              LIVE
            </span>
            <span>·</span>
            <span>
              이벤트 발생 응시자는 자동으로 상단에 확대 표시됩니다. 시선이 자연스럽게 문제
              쪽으로 유도됩니다.
            </span>
          </div>

          {/* Tier 1: 주목 필요 */}
          <Section
            title="주목 필요"
            subtitle="HIGH 이벤트 · 스트림 오류 · 즉각 개입 검토"
            count={alerts.length}
            color="danger"
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

          {/* Tier 2: 경고 */}
          <Section
            title="경고"
            subtitle="WARN 이벤트 · 관찰 유지"
            count={warns.length}
            color="warning"
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

          {/* Tier 3: 정상 */}
          <Section
            title="정상"
            subtitle="INFO 이하 · 존재 확인"
            count={normals.length}
            color="muted"
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

        <aside className="w-96 border-l border-[--color-border] bg-white flex flex-col">
          <div className="p-5 border-b border-[--color-border]">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary">
                실시간 감독 이벤트
              </h3>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[--color-danger] animate-pulse" />
                <span className="text-[10px] text-muted-fg">LIVE</span>
              </div>
            </div>
            <div className="flex gap-1 text-[10px] font-semibold tracking-widest">
              {(["all", "high", "warn", "info"] as SeverityFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={cn(
                    "px-2.5 h-6 rounded-sm border transition uppercase",
                    severityFilter === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-[--color-border] text-muted-fg hover:border-[--color-border-strong]"
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
              <div className="p-8 text-center text-xs text-muted-fg">
                해당 심각도의 이벤트가 없습니다.
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[--color-border] surface-muted">
            <button className="w-full h-9 rounded-sm bg-primary text-primary-foreground text-xs font-semibold tracking-wider hover:bg-[--color-primary-hover]">
              전체 응시자에 공지 발송
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─────────── 섹션 헤더 ─────────── */

function Section({
  title,
  subtitle,
  count,
  color,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  color: "danger" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const dotColor = {
    danger: "bg-[--color-danger]",
    warning: "bg-[--color-warning]",
    muted: "bg-[--color-subtle]",
  }[color];
  const textColor = {
    danger: "text-[--color-danger]",
    warning: "text-[--color-warning]",
    muted: "text-primary",
  }[color];
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <span className={cn("w-2 h-2 rounded-full self-center", dotColor)} />
        <h2 className={cn("text-base font-semibold", textColor)}>{title}</h2>
        <span className="font-tabular text-xs text-muted-fg">
          {count}명
        </span>
        <span className="text-xs text-muted-fg">· {subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-[--color-border] rounded-sm px-4 py-6 text-center text-xs text-muted-fg">
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

  const borderColor = selected
    ? "border-primary shadow-md ring-1 ring-[--color-ring]"
    : hasHighAlert
    ? "border-[--color-danger]"
    : app.lastEvent?.severity === "warn"
    ? "border-[--color-warning]"
    : "border-[--color-border] hover:border-[--color-border-strong]";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-md border bg-white overflow-hidden transition group",
        borderColor
      )}
    >
      {/* 웹캠 썸네일 */}
      <div
        className={cn(
          "relative overflow-hidden",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square",
          app.streaming === "disconnected"
            ? "bg-[--color-danger-muted]"
            : "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950"
        )}
      >
        {app.streaming !== "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/25">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[--color-danger]">
            <div
              className={cn(
                "font-semibold tracking-widest",
                size === "sm" ? "text-[8px]" : "text-[10px]"
              )}
            >
              STREAM LOST
            </div>
          </div>
        )}
        {/* REC 배지 */}
        <div
          className={cn(
            "absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/50 backdrop-blur rounded-sm",
            size === "sm" ? "px-1 py-0.5" : "px-1.5 py-0.5"
          )}
        >
          {app.recording === "recording" && (
            <>
              <span className="w-1 h-1 rounded-full bg-[--color-danger] animate-pulse" />
              {size !== "sm" && (
                <span className="text-[9px] text-white font-tabular">REC</span>
              )}
            </>
          )}
          {app.recording === "error" && size !== "sm" && (
            <span className="text-[9px] text-[--color-warning] font-tabular">ERR</span>
          )}
        </div>
        {/* 경고 카운트 */}
        {app.warningCount > 0 && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 bg-[--color-danger] text-white font-bold rounded-sm flex items-center justify-center font-tabular",
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
        {/* 큰 카드에서 이벤트 라벨 오버레이 */}
        {size === "lg" && app.lastEvent && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm",
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

      {/* 하단 정보 */}
      {size === "sm" ? (
        <div className="px-1.5 py-1 text-center">
          <div className="text-[10px] font-medium text-primary truncate">
            {app.applicant.name}
          </div>
          <div className="text-[9px] font-tabular text-muted-fg">
            {app.progress}%
          </div>
        </div>
      ) : (
        <div className="px-3 py-2">
          <div className="flex items-baseline justify-between mb-1">
            <div
              className={cn(
                "font-medium text-primary truncate",
                size === "lg" ? "text-sm" : "text-xs"
              )}
            >
              {app.applicant.name}
            </div>
            <div className="text-[10px] font-tabular text-muted-fg">
              Q{app.currentQuestion}
            </div>
          </div>
          {size === "lg" && (
            <div className="text-[11px] text-muted-fg truncate mb-2">
              {app.applicant.organization} · {app.applicant.email}
            </div>
          )}
          {size === "md" && (
            <div className="text-[10px] text-muted-fg truncate mb-1.5">
              {app.applicant.organization}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-[--color-subtle] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  hasHighAlert
                    ? "bg-[--color-danger]"
                    : app.lastEvent?.severity === "warn"
                    ? "bg-[--color-warning]"
                    : "bg-[--color-accent]"
                )}
                style={{ width: `${app.progress}%` }}
              />
            </div>
            <div className="text-[10px] font-tabular text-muted-fg">
              {app.progress}%
            </div>
          </div>
          {size === "lg" && (
            <div className="mt-3 flex gap-2">
              <button className="flex-1 h-8 rounded-sm bg-primary text-primary-foreground text-xs font-semibold hover:bg-[--color-primary-hover]">
                개별 채팅
              </button>
              <button className="flex-1 h-8 rounded-sm border border-[--color-border-strong] text-xs font-semibold text-primary hover:bg-[--color-surface-hover]">
                상세 열기
              </button>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/* ─────────── 이벤트 로그 아이템 ─────────── */

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
    high: "text-[--color-danger]",
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
        "w-full text-left px-5 py-3 border-b border-[--color-border] hover:surface-hover transition flex gap-3",
        active && "bg-[--color-accent-muted]"
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
          {event.applicantName} · Q{event.questionIndex}{" "}
          <span className={cn("uppercase font-semibold ml-1", severityText)}>
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

/* ─────────── 상단 통계 소자 ─────────── */

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
    danger: "text-[--color-danger]",
    warning: "text-[--color-warning]",
  }[tone];
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] text-muted-fg tracking-widest uppercase">
        {label}
      </span>
      <span className={cn("font-tabular font-bold text-sm", color)}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-[--color-border]" />;
}
