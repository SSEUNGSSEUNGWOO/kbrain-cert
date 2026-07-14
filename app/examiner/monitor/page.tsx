"use client";

import { useState } from "react";
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

export default function ExaminerMonitorPage() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const filteredEvents = mockRecentEvents.filter(
    (e) => severityFilter === "all" || e.severity === severityFilter
  );

  const stats = {
    total: mockMonitorApplicants.length,
    inProgress: mockMonitorApplicants.filter((a) => a.progress < 100).length,
    submitted: 3,
    flagged: mockMonitorApplicants.filter(
      (a) => a.lastEvent?.severity === "high"
    ).length,
    disconnected: mockMonitorApplicants.filter(
      (a) => a.streaming === "disconnected"
    ).length,
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 상단 헤더 */}
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
          <Stat label="이상감지" value={stats.flagged} tone="danger" />
          <Stat label="스트림오류" value={stats.disconnected} tone="warning" />
        </div>

        <div className="text-sm text-primary font-medium">감독관 · 이명희</div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 응시자 그리드 */}
        <main className="flex-1 overflow-y-auto surface-muted p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">
              응시자 그리드 · {mockMonitorApplicants.length}명
            </h2>
            <div className="text-xs text-muted-fg">
              Daily.co SFU 스트림 · 페이지 1/2
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3">
            {mockMonitorApplicants.map((app) => (
              <ApplicantCard
                key={app.sessionId}
                app={app}
                selected={selectedSession === app.sessionId}
                onSelect={() => setSelectedSession(app.sessionId)}
              />
            ))}
          </div>

          <div className="mt-6 text-xs text-muted-fg text-center">
            30명 표시 · 스트림 대역폭 절약을 위해 그리드는 30개 단위로 페이징
          </div>
        </main>

        {/* 오른쪽 이벤트 패널 */}
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

/* ─────────── 응시자 카드 ─────────── */

function ApplicantCard({
  app,
  selected,
  onSelect,
}: {
  app: MonitorApplicant;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasHighAlert = app.lastEvent?.severity === "high";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-md border bg-white overflow-hidden transition group",
        selected
          ? "border-primary shadow-md ring-1 ring-[--color-ring]"
          : hasHighAlert
          ? "border-[--color-danger]"
          : "border-[--color-border] hover:border-[--color-border-strong]"
      )}
    >
      {/* 웹캠 썸네일 목업 */}
      <div
        className={cn(
          "relative aspect-video overflow-hidden",
          app.streaming === "disconnected"
            ? "bg-[--color-danger-muted]"
            : "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950"
        )}
      >
        {app.streaming !== "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
            {/* 웹캠 아이콘 pseudo */}
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <path d="M15 10l6-3v10l-6-3z" />
            </svg>
          </div>
        )}
        {app.streaming === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[--color-danger]">
            <div className="text-[10px] font-semibold tracking-widest">STREAM LOST</div>
          </div>
        )}
        {/* 좌상단: 녹화 배지 */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-sm">
          {app.recording === "recording" && (
            <>
              <span className="w-1 h-1 rounded-full bg-[--color-danger] animate-pulse" />
              <span className="text-[9px] text-white font-tabular">REC</span>
            </>
          )}
          {app.recording === "error" && (
            <span className="text-[9px] text-[--color-warning] font-tabular">ERR</span>
          )}
        </div>
        {/* 우상단: 경고 배지 */}
        {app.warningCount > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-[--color-danger] text-white text-[10px] font-bold rounded-sm w-5 h-5 flex items-center justify-center font-tabular">
            {app.warningCount}
          </div>
        )}
      </div>

      {/* 하단 정보 */}
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-xs font-medium text-primary truncate">
            {app.applicant.name}
          </div>
          <div className="text-[10px] font-tabular text-muted-fg">
            Q{app.currentQuestion}
          </div>
        </div>
        <div className="text-[10px] text-muted-fg truncate mb-2">
          {app.applicant.organization}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-[--color-subtle] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                hasHighAlert ? "bg-[--color-danger]" : "bg-[--color-accent]"
              )}
              style={{ width: `${app.progress}%` }}
            />
          </div>
          <div className="text-[10px] font-tabular text-muted-fg">{app.progress}%</div>
        </div>
        {app.lastEvent && (
          <div
            className={cn(
              "mt-2 text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium",
              app.lastEvent.severity === "high"
                ? "bg-[--color-danger-muted] text-[--color-danger]"
                : app.lastEvent.severity === "warn"
                ? "bg-[--color-warning-muted] text-[--color-warning]"
                : "bg-[--color-info-muted] text-[--color-info]"
            )}
          >
            {app.lastEvent.label}
          </div>
        )}
      </div>
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
