"use client";

import { useEffect, useState } from "react";
import { createClientSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type EnvItem = { status: string; detail: string };
type SessionInfo = {
  id: string;
  status: string;
  startTime: string | null;
  submitTime: string | null;
  autoSubmitted: boolean;
  isFlagged: boolean;
  updatedAt: string;
  envResult: Record<string, EnvItem> | null;
  pledgeAcceptedAt: string | null;
  waitingEnteredAt: string | null;
  userAgent: string | null;
};
type ExamInfo = {
  id: string;
  title: string;
  durationMinutes: number;
  passScore: number;
  examDate: string | null;
};
type InvitationInfo = {
  id: string;
  name: string | null;
  email: string;
  organization: string | null;
  inviteCode: string;
  sentAt: string | null;
  usedAt: string | null;
};
type Event = {
  id: number;
  eventType: string;
  severity: string;
  detectedAt: string;
  questionIndex: number | null;
  payload: unknown;
};
type Answer = {
  id: string;
  questionId: string;
  slotValues: Record<string, unknown> | null;
  submittedAt: string | null;
  updatedAt: string;
};
type Question = {
  id: string;
  code: string;
  content: string;
  submissionSlots: Array<{
    id: string;
    type: string;
    label: string;
    max_score: number;
  }>;
  maxScore: number;
  setOrder: number;
};
type Counts = {
  answered: number;
  totalQuestions: number;
  highEvents: number;
  warnEvents: number;
  infoEvents: number;
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

const ENV_LABELS: Record<string, string> = {
  monitor: "듀얼 모니터",
  webcam: "웹캠",
  screen: "화면 공유",
  network: "네트워크",
  cpu: "CPU",
  browser: "브라우저",
};

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  ok: { color: "bg-success text-white", label: "OK" },
  warn: { color: "bg-warning text-white", label: "WARN" },
  error: { color: "bg-danger text-white", label: "ERROR" },
  pending: { color: "bg-subtle text-muted", label: "..." },
};

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/examiner/session/${sessionId}?t=${Date.now()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "조회 실패");
          return;
        }
        setSession(data.session);
        setExam(data.exam);
        setInvitation(data.invitation);
        setEvents(data.events ?? []);
        setAnswers(data.answers ?? []);
        setQuestions(data.questions ?? []);
        setCounts(data.counts);
        setLastFetched(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    };
    void fetchData();
    const pollingId = setInterval(fetchData, 20_000);

    // Realtime 구독 · 이벤트/답안/세션 변경 시 refetch
    const supabase = createClientSupabase();
    const channel = supabase
      .channel(`examiner-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monitoring_events",
          filter: `session_id=eq.${sessionId}`,
        },
        () => void fetchData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "answers",
          filter: `session_id=eq.${sessionId}`,
        },
        () => void fetchData()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => void fetchData()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollingId);
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-md bg-danger-soft border border-danger p-6 text-danger text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!session || !exam) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-muted-foreground text-sm">
        불러오는 중…
      </div>
    );
  }

  const activeAnswerMap = new Map(answers.map((a) => [a.questionId, a]));
  const activeQuestion =
    selectedQuestion
      ? questions.find((q) => q.id === selectedQuestion)
      : questions[0];
  const activeAnswer = activeQuestion
    ? activeAnswerMap.get(activeQuestion.id)
    : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6 space-y-5">
      {/* 헤더 */}
      <div className="rounded-md bg-white border border-border p-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded-md flex items-center justify-center font-bold text-xl shrink-0",
              session.isFlagged
                ? "bg-danger text-white"
                : session.submitTime
                ? "bg-success text-white"
                : "bg-primary text-white"
            )}
          >
            {(invitation?.name ?? invitation?.email ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={session.status} />
              {session.isFlagged && (
                <span className="text-[10px] font-bold tracking-widest text-danger bg-danger-soft px-2 py-0.5 rounded-sm uppercase animate-pulse">
                  Flagged
                </span>
              )}
              {session.autoSubmitted && (
                <span className="text-[10px] font-bold tracking-widest text-warning bg-warning-soft px-2 py-0.5 rounded-sm uppercase">
                  Auto-submitted
                </span>
              )}
            </div>
            <div className="font-bold text-xl">
              {invitation?.name ?? "-"}{" "}
              <span className="text-sm text-muted-foreground font-normal ml-1">
                {invitation?.email}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {invitation?.organization ?? "-"} · 초대코드{" "}
              <span className="font-tabular font-bold">
                {invitation?.inviteCode ?? "-"}
              </span>
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground font-tabular">
            <div>시험: {exam.title}</div>
            <div>{exam.durationMinutes}분</div>
            {lastFetched && (
              <div className="mt-1">
                갱신 {lastFetched.toLocaleTimeString("ko-KR")}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mt-5">
          <TimingCell
            label="시험 시작"
            value={session.startTime}
            tone="primary"
          />
          <TimingCell
            label="시험 종료"
            value={session.submitTime}
            tone={session.submitTime ? "success" : "muted"}
          />
          <TimingCell
            label="대기실 진입"
            value={session.waitingEnteredAt}
            tone="info"
          />
          <TimingCell
            label="서약 동의"
            value={session.pledgeAcceptedAt}
            tone="info"
          />
          <StatCell
            label="답변 완료"
            value={`${counts?.answered ?? 0} / ${counts?.totalQuestions ?? 0}`}
            tone="primary"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <StatCell
            label="HIGH 이벤트"
            value={String(counts?.highEvents ?? 0)}
            tone="danger"
          />
          <StatCell
            label="WARN 이벤트"
            value={String(counts?.warnEvents ?? 0)}
            tone="warning"
          />
          <StatCell
            label="INFO 이벤트"
            value={String(counts?.infoEvents ?? 0)}
            tone="info"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 좌: 이벤트 타임라인 */}
        <div className="col-span-1 space-y-5">
          <div className="rounded-md bg-white border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
                  Timeline
                </div>
                <div className="text-sm font-bold">감독 이벤트</div>
              </div>
              <span className="text-xs text-muted-foreground font-tabular">
                {events.length}
              </span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {events.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  이벤트가 없습니다
                </div>
              )}
              {events.map((e) => {
                const label = EVENT_LABEL[e.eventType] ?? e.eventType;
                const style =
                  e.severity === "high"
                    ? "border-l-danger bg-danger-soft/30"
                    : e.severity === "warn"
                    ? "border-l-warning bg-warning-soft/30"
                    : "border-l-info bg-info-soft/30";
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "border-l-2 px-4 py-3 border-b border-border",
                      style
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="text-sm font-bold truncate">{label}</span>
                      <span className="text-[10px] font-tabular text-muted whitespace-nowrap">
                        {new Date(e.detectedAt).toLocaleTimeString("ko-KR")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="uppercase font-bold">{e.severity}</span>
                      {e.questionIndex != null && ` · Q${e.questionIndex}`}
                    </div>
                    {typeof e.payload === "object" && e.payload && (
                      <div className="text-[10px] font-tabular text-muted mt-1 break-all">
                        {JSON.stringify(e.payload)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 중: 답안 목록 · 문항별 미리보기 */}
        <div className="col-span-2 space-y-5">
          <div className="rounded-md bg-white border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
                  Answers
                </div>
                <div className="text-sm font-bold">답안 미리보기</div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5 p-3 border-b border-border">
              {questions.map((q, i) => {
                const answer = activeAnswerMap.get(q.id);
                const answered = answer
                  ? Object.values(answer.slotValues ?? {}).some(
                      (v) => v !== "" && v != null
                    )
                  : false;
                const isCurrent = activeQuestion?.id === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuestion(q.id)}
                    className={cn(
                      "aspect-square rounded-sm text-[11px] font-bold tabular-nums transition",
                      isCurrent
                        ? "bg-primary text-white ring-2 ring-primary-soft"
                        : answered
                        ? "bg-success-soft text-success"
                        : "bg-surface-soft text-muted"
                    )}
                    title={q.code}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {activeQuestion && (
              <div className="p-5">
                <div className="mb-3">
                  <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">
                    문항 {activeQuestion.setOrder} · 배점 {activeQuestion.maxScore}점
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto p-3 bg-surface-soft rounded-sm">
                    {activeQuestion.content}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {activeQuestion.submissionSlots.map((slot) => {
                    const v = activeAnswer?.slotValues?.[slot.id];
                    return (
                      <div key={slot.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold">{slot.label}</span>
                          <span className="text-[10px] font-tabular text-muted uppercase tracking-widest">
                            {slot.type} · {slot.max_score}점
                          </span>
                        </div>
                        {v ? (
                          <div className="text-sm text-foreground whitespace-pre-wrap break-all font-tabular">
                            {String(v).slice(0, 500)}
                            {String(v).length > 500 && (
                              <span className="text-muted"> …생략</span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted italic">미작성</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Precheck 요약 */}
          {session.envResult && (
            <div className="rounded-md bg-white border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
                  Precheck
                </div>
                <div className="text-sm font-bold">환경 체크 결과</div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                {Object.entries(ENV_LABELS).map(([key, label]) => {
                  const item = session.envResult?.[key];
                  const style =
                    STATUS_STYLE[item?.status ?? "pending"] ??
                    STATUS_STYLE.pending;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
                    >
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-sm text-[10px] font-bold w-14 text-center shrink-0",
                          style.color
                        )}
                      >
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold">{label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {item?.detail ?? "-"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {session.userAgent && (
                <div className="px-4 py-3 border-t border-border text-[10px] font-tabular text-muted break-all">
                  UA: {session.userAgent}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style: Record<string, { bg: string; label: string }> = {
    waiting: { bg: "bg-info-soft text-info", label: "WAITING" },
    in_progress: { bg: "bg-primary text-white", label: "IN PROGRESS" },
    submitted: { bg: "bg-success-soft text-success", label: "SUBMITTED" },
    passed: { bg: "bg-success text-white", label: "PASSED" },
    failed: { bg: "bg-danger-soft text-danger", label: "FAILED" },
  };
  const s = style[status] ?? { bg: "bg-surface-soft text-muted", label: status };
  return (
    <span
      className={cn(
        "text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm uppercase",
        s.bg
      )}
    >
      {s.label}
    </span>
  );
}

function TimingCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone: "primary" | "success" | "info" | "muted";
}) {
  const color = {
    primary: "text-primary",
    success: "text-success",
    info: "text-info",
    muted: "text-muted",
  }[tone];
  return (
    <div className="rounded-sm bg-surface-soft p-2.5">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
        {label}
      </div>
      <div className={cn("text-xs font-bold font-tabular", color)}>
        {value ? new Date(value).toLocaleTimeString("ko-KR") : "-"}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "danger" | "warning" | "info";
}) {
  const color = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    info: "text-info",
  }[tone];
  return (
    <div className="rounded-sm bg-surface-soft p-3">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
        {label}
      </div>
      <div className={cn("text-lg font-bold font-tabular", color)}>
        {value}
      </div>
    </div>
  );
}
