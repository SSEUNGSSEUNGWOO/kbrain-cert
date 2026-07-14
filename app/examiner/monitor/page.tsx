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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          >
            KB
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              감독관 대시보드
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {mockExam.title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatChip label="응시" value={stats.total} />
            <StatChip label="진행중" value={stats.inProgress} tone="blue" />
            <StatChip label="제출" value={stats.submitted} tone="emerald" />
            <StatChip label="주목" value={stats.alerts} tone="rose" />
            <StatChip label="경고" value={stats.warns} tone="amber" />
          </div>
          <div className="text-xs text-right border-l border-slate-200 pl-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              감독관
            </div>
            <div className="font-semibold text-slate-900">이명희</div>
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto max-w-7xl w-full px-6 py-6 flex gap-6">
        <main className="flex-1 min-w-0 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-3 text-sm text-slate-700 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              LIVE
            </span>
            <span className="text-slate-600">
              이벤트 발생 응시자는 자동으로 상단에 확대 배치되어 시선이 문제 응시자로 자연 유도됩니다.
            </span>
          </div>

          <Section
            step="1"
            title="주목 필요"
            tag="ALERT"
            subtitle="HIGH severity · 스트림 오류 · 즉각 개입 검토"
            count={alerts.length}
            tone="rose"
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
            title="경고"
            tag="WARN"
            subtitle="WARN severity · 관찰 유지"
            count={warns.length}
            tone="amber"
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
            title="정상"
            tag="NORMAL"
            subtitle="INFO 이하 · 존재 확인"
            count={normals.length}
            tone="slate"
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

        <aside className="w-96 flex-shrink-0">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">
                    이벤트 스트림
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    실시간 감독 이벤트
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 uppercase tracking-widest">
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <div className="flex gap-1 text-[10px] font-semibold uppercase tracking-widest">
                {(["all", "high", "warn", "info"] as SeverityFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={cn(
                      "px-2.5 h-7 rounded-md border transition",
                      severityFilter === s
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
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
                <div className="p-8 text-center text-xs text-slate-500">
                  해당 심각도의 이벤트가 없습니다.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/40">
              <button className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-sm">
                전체 응시자에 공지 발송
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─────────── Section ─────────── */

function Section({
  step,
  title,
  tag,
  subtitle,
  count,
  tone,
  children,
}: {
  step: string;
  title: string;
  tag: string;
  subtitle: string;
  count: number;
  tone: "rose" | "amber" | "slate";
  children: React.ReactNode;
}) {
  const toneMap = {
    rose: "bg-rose-100 text-rose-800 border-rose-300",
    amber: "bg-amber-100 text-amber-800 border-amber-300",
    slate: "bg-slate-100 text-slate-700 border-slate-300",
  }[tone];
  return (
    <section>
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center h-7 min-w-[2rem] px-2 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">
          {step}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
            toneMap
          )}
        >
          {tag}
        </span>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <span className="text-[11px] text-slate-500 tabular-nums">
          {count}명
        </span>
        <span className="text-xs text-slate-500">· {subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

/* ─────────── Applicant Card ─────────── */

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

  const wrapClass = selected
    ? "border-blue-500 ring-2 ring-blue-100"
    : hasHighAlert
    ? "border-rose-300"
    : hasWarn
    ? "border-amber-300"
    : "border-slate-200";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-2xl border-2 bg-white shadow-sm overflow-hidden transition group hover:shadow-md",
        wrapClass
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          size === "lg" ? "aspect-video" : size === "md" ? "aspect-video" : "aspect-square",
          app.streaming === "disconnected"
            ? "bg-rose-100"
            : "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400"
        )}
      >
        {app.streaming !== "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <svg
              viewBox="0 0 24 24"
              className={cn(
                size === "lg" ? "w-14 h-14" : size === "md" ? "w-9 h-9" : "w-5 h-5"
              )}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <path d="M15 10l6-3v10l-6-3z" />
            </svg>
          </div>
        )}
        {app.streaming === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-700">
            <div
              className={cn(
                "font-bold uppercase tracking-widest",
                size === "sm" ? "text-[8px]" : "text-[10px]"
              )}
            >
              스트림 오류
            </div>
          </div>
        )}
        <div
          className={cn(
            "absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/55 backdrop-blur rounded-md",
            size === "sm" ? "px-1 py-0.5" : "px-1.5 py-0.5"
          )}
        >
          {app.recording === "recording" && (
            <>
              <span className="w-1 h-1 rounded-full bg-rose-400 animate-pulse" />
              {size !== "sm" && (
                <span className="text-[9px] text-white font-mono">REC</span>
              )}
            </>
          )}
          {app.recording === "error" && size !== "sm" && (
            <span className="text-[9px] text-amber-300 font-mono">ERR</span>
          )}
        </div>
        {app.warningCount > 0 && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 bg-rose-500 text-white font-bold rounded-md flex items-center justify-center font-mono",
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
              "absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm",
              app.lastEvent.severity === "high"
                ? "bg-rose-600/85"
                : app.lastEvent.severity === "warn"
                ? "bg-amber-600/85"
                : "bg-slate-800/70"
            )}
          >
            {app.lastEvent.label}
          </div>
        )}
      </div>

      {size === "sm" ? (
        <div className="px-1.5 py-1.5 text-center">
          <div className="text-[10px] font-semibold text-slate-800 truncate">
            {app.applicant.name}
          </div>
          <div className="text-[9px] text-slate-500 tabular-nums">
            {app.progress}%
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between mb-1">
            <div
              className={cn(
                "font-semibold text-slate-900 truncate",
                size === "lg" ? "text-sm" : "text-xs"
              )}
            >
              {app.applicant.name}
            </div>
            <div className="text-[10px] text-blue-600 font-semibold tabular-nums">
              Q{app.currentQuestion}
            </div>
          </div>
          {size === "lg" && (
            <div className="text-[11px] text-slate-500 truncate mb-3">
              {app.applicant.organization} · {app.applicant.email}
            </div>
          )}
          {size === "md" && (
            <div className="text-[10px] text-slate-500 truncate mb-2">
              {app.applicant.organization}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  hasHighAlert
                    ? "bg-rose-500"
                    : hasWarn
                    ? "bg-amber-500"
                    : "bg-blue-500"
                )}
                style={{ width: `${app.progress}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {app.progress}%
            </div>
          </div>
          {size === "lg" && (
            <div className="mt-3 flex gap-2">
              <button className="flex-1 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">
                개별 채팅
              </button>
              <button className="flex-1 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50">
                상세 열기
              </button>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/* ─────────── Event Item ─────────── */

function EventItem({
  event,
  onClick,
  active,
}: {
  event: ProctoringEvent;
  onClick: () => void;
  active: boolean;
}) {
  const bar = {
    high: "bg-rose-500",
    warn: "bg-amber-500",
    info: "bg-blue-500",
  }[event.severity];
  const label = {
    face_missing: "얼굴 미검출",
    multiple_faces: "복수 인원 감지",
    voice_detected: "음성 감지",
    fullscreen_exit: "전체화면 이탈",
    tab_switch: "탭 전환",
    recording_error: "녹화 오류",
  }[event.type];
  const severityChip = {
    high: "bg-rose-100 text-rose-700 border-rose-300",
    warn: "bg-amber-100 text-amber-800 border-amber-300",
    info: "bg-blue-100 text-blue-700 border-blue-300",
  }[event.severity];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-3 border-b border-slate-100 hover:bg-slate-50/60 transition flex gap-3",
        active && "bg-blue-50/50"
      )}
    >
      <div className={cn("w-1 rounded-full self-stretch", bar)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {label}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0 text-[9px] font-bold uppercase",
              severityChip
            )}
          >
            {event.severity}
          </span>
          <span className="ml-auto text-[10px] text-slate-500 font-mono">
            {event.occurredAt}
          </span>
        </div>
        <div className="text-[11px] text-slate-600 truncate">
          {event.applicantName} · Q{event.questionIndex}
        </div>
        {event.note && (
          <div className="text-[10px] text-slate-500 italic mt-0.5">
            {event.note}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─────────── Stat Chip ─────────── */

function StatChip({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "blue" | "emerald" | "rose" | "amber";
}) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
  }[tone];
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center px-2.5 py-1 rounded-lg border tabular-nums",
        toneMap
      )}
    >
      <span className="text-[9px] uppercase tracking-widest opacity-70">
        {label}
      </span>
      <span className="text-sm font-bold leading-none mt-0.5">{value}</span>
    </div>
  );
}
