"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AttachmentViewer, type Attachment } from "@/components/attachment-viewer";
import { EnvCheck, type EnvResultSnapshot } from "@/components/env-check";
import { SecurityPledge } from "@/components/security-pledge";
import { WaitingRoom } from "@/components/waiting-room";
import { useSavePrecheck } from "@/lib/hooks/use-save-precheck";
import { useAutoSaveAnswer } from "@/lib/hooks/use-auto-save-answer";
import { useExamTimer, formatHms } from "@/lib/hooks/use-exam-timer";
import { useMonitorEvents } from "@/lib/hooks/use-monitor-events";
import { useExamSessionLive } from "@/lib/hooks/use-exam-session-live";
import { ProctorGuard } from "@/components/proctor-guard";
import { ExamChat } from "@/components/exam-chat";
import { cn } from "@/lib/utils";

type Slot = {
  id: string;
  type: "text" | "long_text" | "url" | "file" | "number";
  label: string;
  max_score: number;
  accept?: string;
};

type Question = {
  id: string;
  code: string;
  content: string;
  submission_slots: Slot[];
  max_score: number;
  set_id: string;
  set_order: number;
  tags: string[];
  difficulty: string | null;
};

type Set = {
  id: string;
  title: string;
  scenario: string | null;
  attachments: Attachment[];
};

type Tab = "env" | "pledge" | "waiting" | "exam";

export function PracticeRunner({
  slug,
  exam,
  sets,
  questions,
  sessionId,
  skipToExam = false,
}: {
  slug: string;
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
    /** 실 시험 예약 시각 · 실 시험이면 이 시각을 기준으로 카운트다운·자동 제출 */
    examDate?: string | null;
  };
  sets: Set[];
  questions: Question[];
  /** 실 시험 세션 id · Practice에서는 null · 있으면 precheck 결과 서버 저장 */
  sessionId?: string | null;
  /** Practice ?skip=1 · 환경체크/서약/대기실 건너뛰고 시험창부터 (미리보기용) */
  skipToExam?: boolean;
}) {
  const savePrecheck = useSavePrecheck(sessionId);
  const [tab, setTab] = useState<Tab>(skipToExam ? "exam" : "env");
  const [envPassed, setEnvPassed] = useState(skipToExam);
  const [pledgePassed, setPledgePassed] = useState(skipToExam);
  const [waitingReady, setWaitingReady] = useState(skipToExam);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});

  // 웹캠 · 화면 공유 스트림 · 환경 체크에서 획득 → 페이지 unmount까지 유지
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    return () => {
      webcamStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQ = questions[currentIdx];
  const currentSet = sets.find((s) => s.id === currentQ?.set_id);
  const currentAnswer = currentQ ? answers[currentQ.id] ?? {} : {};

  // 답안 auto-save · sessionId 없으면 no-op (Practice)
  const { status: saveStatus, lastSavedAt } = useAutoSaveAnswer(
    sessionId,
    currentQ?.id,
    currentAnswer
  );

  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverStartTime, setServerStartTime] = useState<string | null>(null);

  const isRealExam = sessionId != null;

  // exam 탭 진입 시 시작 시각 서버에서 확정 (실 시험만)
  useEffect(() => {
    if (tab !== "exam" || !isRealExam || !sessionId || serverStartTime) return;
    void fetch("/api/exam/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.startTime) setServerStartTime(data.startTime);
      })
      .catch(() => {});
  }, [tab, isRealExam, sessionId, serverStartTime]);

  // Practice는 로컬 시간 기준 · exam 탭 진입 시각으로 폴백
  const [practiceStartTime, setPracticeStartTime] = useState<string | null>(null);
  const enterExam = () => {
    if (!isRealExam && !practiceStartTime) {
      setPracticeStartTime(new Date().toISOString());
    }
    setTab("exam");
  };

  // 감독 이벤트 batch 저장 (실 시험만 · Practice는 no-op)
  const { fire: fireMonitorEvent } = useMonitorEvents(sessionId);

  // 세션 라이브: 시간 연장 · 강제 종료 감지 · 채팅 메시지 (타이머 전에 선언 · 아래에서 참조)
  const { live: sessionLive, markRead: markChatRead } =
    useExamSessionLive(sessionId);

  // 감독관이 강제 종료했으면 done 페이지로 이동
  useEffect(() => {
    if (sessionLive.isSubmitted && sessionId && tab === "exam") {
      window.location.href = `/exam/session/${sessionId}/done`;
    }
  }, [sessionLive.isSubmitted, sessionId, tab]);

  // 타이머 기준 시각
  // - 실 시험 + exam_date 있음 → exam_date 기준 (모든 응시자 동시 종료)
  // - 실 시험 + exam_date 없음 → 개인 진입 시각 폴백 (start_time)
  // - Practice → 개인 로컬 진입 시각
  const effectiveStartTime =
    isRealExam
      ? exam.examDate ?? serverStartTime
      : practiceStartTime;
  const effectiveDurationMinutes =
    exam.durationMinutes + (isRealExam ? sessionLive.timeExtensionMinutes : 0);
  const timer = useExamTimer(effectiveStartTime, effectiveDurationMinutes);

  // 타이머 만료 시 자동 제출 (실 시험만 · 1회 발화)
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (
      timer.expired &&
      isRealExam &&
      !submitting &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      void doSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.expired, isRealExam, submitting]);
  const answeredCount = Object.keys(answers).filter(
    (qId) => Object.values(answers[qId] ?? {}).some((v) => v !== "" && v != null)
  ).length;

  async function doSubmit(auto = false) {
    if (!sessionId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/exam/session/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, auto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "제출 실패");
      window.location.href = `/exam/session/${sessionId}/done`;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "제출 실패");
      setSubmitting(false);
    }
  }
  const questionsBySet = useMemo(() => {
    const map: Record<string, Question[]> = {};
    for (const q of questions) {
      if (!map[q.set_id]) map[q.set_id] = [];
      map[q.set_id].push(q);
    }
    return map;
  }, [questions]);

  const setIndex = sets.findIndex((s) => s.id === currentQ?.set_id);
  const questionIndexInSet =
    questionsBySet[currentQ?.set_id]?.findIndex((q) => q.id === currentQ.id) ??
    -1;

  const showTimer = tab === "exam";
  const proctorActive = tab === "exam" && isRealExam;

  return (
    <div className="min-h-screen flex flex-col">
      <ProctorGuard
        active={proctorActive}
        onEvent={fireMonitorEvent}
        onForceSubmit={() => {
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            void doSubmit(true);
          }
        }}
      />
      <TopBar
        exam={exam}
        slug={slug}
        timer={showTimer ? timer : null}
        isRealExam={isRealExam}
      />

      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-6 flex gap-1 overflow-x-auto">
          <TabButton
            active={tab === "env"}
            onClick={() => setTab("env")}
            label="1. 환경 체크"
            hint="6개 항목 자동 검사"
            done={envPassed}
          />
          <TabButton
            active={tab === "pledge"}
            onClick={() => envPassed && setTab("pledge")}
            label="2. 보안 서약"
            hint={envPassed ? "7개 유의사항 동의" : "환경 체크 후 이용"}
            done={pledgePassed}
            disabled={!envPassed}
          />
          <TabButton
            active={tab === "waiting"}
            onClick={() => pledgePassed && setTab("waiting")}
            label="3. 대기실"
            hint={pledgePassed ? "시험 시작 대기" : "서약 완료 후 이용"}
            done={waitingReady}
            disabled={!pledgePassed}
          />
          <TabButton
            active={tab === "exam"}
            onClick={() => waitingReady && enterExam()}
            label="4. 시험창"
            hint={
              waitingReady
                ? `${questions.length}문항 · ${sets.length}세트`
                : "대기실에서 입장"
            }
            disabled={!waitingReady}
          />
        </div>
      </div>

      {tab === "env" && (
        <div className="flex-1 mx-auto max-w-3xl w-full px-6 py-6">
          <EnvCheck
            webcamStream={webcamStream}
            setWebcamStream={setWebcamStream}
            screenStream={screenStream}
            setScreenStream={setScreenStream}
            onEnterExam={(snapshot: EnvResultSnapshot) => {
              void savePrecheck("env", {
                envResult: snapshot,
                userAgent:
                  typeof navigator !== "undefined" ? navigator.userAgent : "",
              });
              setEnvPassed(true);
              setTab("pledge");
            }}
          />
        </div>
      )}

      {tab === "pledge" && (
        <div className="flex-1 mx-auto max-w-3xl w-full px-6 py-6">
          <SecurityPledge
            onProceed={() => {
              void savePrecheck("pledge");
              setPledgePassed(true);
              setTab("waiting");
            }}
          />
        </div>
      )}

      {tab === "waiting" && (
        <div className="flex-1 mx-auto max-w-3xl w-full px-6 py-6">
          <WaitingRoom
            exam={exam}
            isPractice={sessionId == null}
            scheduledAt={
              isRealExam && exam.examDate ? new Date(exam.examDate) : undefined
            }
            sessionId={sessionId ?? null}
            initialIdentityPath={null}
            onEnter={() => {
              void savePrecheck("waiting");
              setWaitingReady(true);
              enterExam();
            }}
          />
        </div>
      )}

      {tab === "exam" && (
      <div className="flex-1 mx-auto max-w-7xl w-full px-6 py-6 flex gap-6">
        {/* 감시 스트림 상시 표시 · 우측 하단 · 감독관 감시 중임을 시각화 */}
        <MonitoringBadge
          webcamStream={webcamStream}
          screenActive={!!screenStream}
        />

        {/* 실 시험: 감독관 채팅 · Practice에서는 표시 X */}
        {isRealExam && (
          <ExamChat
            messages={sessionLive.messages}
            unreadCount={sessionLive.unreadCount}
            isSubmitted={sessionLive.isSubmitted}
            onOpen={markChatRead}
          />
        )}

        {/* 시간 연장 공지 */}
        {isRealExam && sessionLive.timeExtensionMinutes > 0 && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-md bg-success text-white px-4 py-2 shadow-lg text-xs font-bold">
            ⏱ 감독관이 시험 시간을 +{sessionLive.timeExtensionMinutes}분 연장했습니다
          </div>
        )}

        {/* 좌측 문항 그리드 */}
        <QuestionRail
          sets={sets}
          questionsBySet={questionsBySet}
          questions={questions}
          currentQuestionId={currentQ?.id}
          onSelect={(qId) => {
            const i = questions.findIndex((q) => q.id === qId);
            if (i >= 0) setCurrentIdx(i);
          }}
        />

        {/* 중앙 문항 */}
        <main className="flex-1 min-w-0 space-y-6">
          {currentSet && (
            <SetHeader
              setIndex={setIndex}
              set={currentSet}
              questionIndexInSet={questionIndexInSet}
              totalInSet={questionsBySet[currentSet.id]?.length ?? 0}
              slug={slug}
            />
          )}

          {currentQ && (
            <QuestionCard
              question={currentQ}
              answer={answers[currentQ.id] ?? {}}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [currentQ.id]: v }))
              }
              sessionId={sessionId ?? null}
            />
          )}

          {isRealExam && (
            <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="h-11 px-5 rounded-md bg-white border border-border text-sm font-bold hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← 이전 문항
            </button>
            <div className="text-xs text-muted-foreground font-tabular">
              {currentIdx + 1} / {questions.length}
            </div>
            {currentIdx === questions.length - 1 && isRealExam ? (
              <button
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting}
                className="h-11 px-5 rounded-md bg-success hover:opacity-90 text-white text-sm font-bold disabled:opacity-40 transition"
              >
                시험 제출하기 →
              </button>
            ) : (
              <button
                onClick={() =>
                  setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
                }
                disabled={currentIdx === questions.length - 1}
                className="h-11 px-5 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                다음 문항 →
              </button>
            )}
          </div>
        </main>
      </div>
      )}

      {confirmSubmit && isRealExam && (
        <SubmitConfirmDialog
          answeredCount={answeredCount}
          totalCount={questions.length}
          submitting={submitting}
          error={submitError}
          onCancel={() => {
            setConfirmSubmit(false);
            setSubmitError(null);
          }}
          onConfirm={() => doSubmit(false)}
        />
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  lastSavedAt,
}: {
  status: "idle" | "pending" | "saved" | "error";
  lastSavedAt: Date | null;
}) {
  const style = {
    idle: { color: "text-muted-foreground", label: "저장 대기" },
    pending: { color: "text-info", label: "저장 중…" },
    saved: {
      color: "text-success",
      label: lastSavedAt
        ? `저장됨 · ${lastSavedAt.toLocaleTimeString("ko-KR", {
            hour12: false,
          })}`
        : "저장됨",
    },
    error: { color: "text-danger", label: "저장 실패 · 네트워크 확인" },
  }[status];
  return (
    <div className={cn("text-[11px] font-bold text-right", style.color)}>
      · {style.label}
    </div>
  );
}

function SubmitConfirmDialog({
  answeredCount,
  totalCount,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  answeredCount: number;
  totalCount: number;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unanswered = totalCount - answeredCount;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="rounded-md bg-white border border-border w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-bold text-base">시험을 제출하시겠습니까?</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-md bg-surface-soft p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">답변 완료</span>
              <span className="font-bold font-tabular">
                {answeredCount} / {totalCount}
              </span>
            </div>
            {unanswered > 0 && (
              <div className="text-xs text-warning font-bold">
                ⚠ {unanswered}개 문항이 미답변 상태입니다
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            제출 후에는 답안을 수정할 수 없습니다. 시험이 종료되며 응시가 완료됩니다.
          </div>
          {error && (
            <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 h-11 rounded-md bg-white border border-border text-sm font-bold hover:border-primary disabled:opacity-50 transition"
            >
              계속 응시
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className="flex-1 h-11 rounded-md bg-success hover:opacity-90 text-white text-sm font-bold disabled:opacity-50 transition"
            >
              {submitting ? "제출 중…" : "제출하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────── 감시 스트림 상시 표시 (시험창) ────── */

function MonitoringBadge({
  webcamStream,
  screenActive,
}: {
  webcamStream: MediaStream | null;
  screenActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [webcamStream]);
  return (
    <div className="fixed bottom-6 right-6 z-40 rounded-md bg-white border border-border shadow-lg overflow-hidden w-48">
      <div className="px-3 py-2 border-b border-border bg-surface-soft flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <span className="text-[10px] font-bold tracking-widest text-danger uppercase">
          감시 중
        </span>
      </div>
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full aspect-video bg-black object-cover"
      />
      <div className="px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              webcamStream ? "bg-success" : "bg-danger"
            )}
          />
          웹캠
        </span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              screenActive ? "bg-success" : "bg-danger"
            )}
          />
          화면
        </span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  hint,
  done,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  done?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-5 py-3 border-b-2 transition text-left",
        active && !disabled && "border-primary text-primary",
        !active &&
          !disabled &&
          "border-transparent text-muted-foreground hover:text-foreground",
        disabled && "border-transparent text-muted cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "text-sm font-bold",
            active && !disabled && "text-primary",
            disabled && "text-muted"
          )}
        >
          {label}
        </div>
        {done && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-success text-white text-[9px] font-bold">
            ✓
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </button>
  );
}

/* ────── Top bar ────── */

function TopBar({
  exam,
  slug,
  timer,
  isRealExam,
}: {
  exam: {
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
  };
  slug: string;
  timer: { remainingMs: number; totalMs: number; expired: boolean } | null;
  isRealExam: boolean;
}) {
  const minutes = timer ? timer.remainingMs / 60000 : Number.POSITIVE_INFINITY;
  const dangerZone = minutes < 3;
  const warnZone = !dangerZone && minutes < 10;
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
        </Link>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[10px] font-bold tracking-widest uppercase mb-0.5",
              isRealExam ? "text-danger" : "text-info"
            )}
          >
            {isRealExam ? "REAL · 실 응시" : "Practice · 테스트 링크"}
          </div>
          <div className="font-bold text-sm truncate">{exam.title}</div>
        </div>
        {timer && (
          <div
            className={cn(
              "text-right leading-tight px-3 py-1.5 rounded-md",
              dangerZone && "bg-danger-soft animate-pulse",
              warnZone && "bg-warning-soft",
              !dangerZone && !warnZone && "bg-info-soft"
            )}
          >
            <div
              className={cn(
                "text-[10px] font-bold tracking-widest uppercase",
                dangerZone
                  ? "text-danger"
                  : warnZone
                  ? "text-warning"
                  : "text-info"
              )}
            >
              {timer.expired ? "시간 종료" : "남은 시간"}
            </div>
            <div
              className={cn(
                "font-tabular tabular-nums text-lg font-bold",
                dangerZone
                  ? "text-danger"
                  : warnZone
                  ? "text-warning"
                  : "text-info"
              )}
            >
              {formatHms(timer.remainingMs)}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          {exam.grade && (
            <span className="hidden md:inline-flex text-[10px] font-bold text-primary bg-primary-soft px-2 py-1 rounded-sm">
              {exam.grade}
            </span>
          )}
          <span className="hidden md:inline-flex text-[10px] font-bold text-muted-foreground bg-surface-soft px-2 py-1 rounded-sm">
            {exam.durationMinutes}분
          </span>
          {!isRealExam && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-info bg-info-soft px-2.5 py-1 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              답안 저장 X
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ────── 좌측 문항 그리드 ────── */

function QuestionRail({
  sets,
  questionsBySet,
  questions,
  currentQuestionId,
  onSelect,
}: {
  sets: Set[];
  questionsBySet: Record<string, Question[]>;
  questions: Question[];
  currentQuestionId: string | undefined;
  onSelect: (qId: string) => void;
}) {
  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-24 rounded-md bg-white border border-border p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] font-bold tracking-[0.25em] text-muted uppercase">
            문항 · 총 {questions.length}
          </div>
        </div>

        <div className="space-y-4">
          {sets.map((set, si) => {
            const qs = questionsBySet[set.id] ?? [];
            return (
              <div key={set.id}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-tabular text-xs font-bold text-primary tabular-nums">
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <div className="text-[11px] font-bold text-foreground truncate">
                    {set.title}
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {qs.map((q, qi) => {
                    const isCurrent = q.id === currentQuestionId;
                    return (
                      <button
                        key={q.id}
                        onClick={() => onSelect(q.id)}
                        title={q.code}
                        className={cn(
                          "aspect-square rounded-sm text-[11px] font-bold tabular-nums transition",
                          isCurrent
                            ? "bg-primary text-white ring-2 ring-primary-soft"
                            : "bg-surface-soft text-muted-foreground hover:bg-subtle"
                        )}
                      >
                        {qi + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
          <div className="font-bold text-foreground mb-1">테스트 링크</div>
          여러 번 접속 · 답 저장 X · 첨부는 다운로드 가능
        </div>
      </div>
    </aside>
  );
}

/* ────── Set 헤더 (시나리오 + 첨부) ────── */

function SetHeader({
  setIndex,
  set,
  questionIndexInSet,
  totalInSet,
  slug,
}: {
  setIndex: number;
  set: Set;
  questionIndexInSet: number;
  totalInSet: number;
  slug: string;
}) {
  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      {/* Set 정보 헤더 */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary-soft/60 to-white flex items-center gap-4">
        <div className="w-12 h-12 rounded-md bg-white border-2 border-primary text-primary flex items-center justify-center font-bold text-lg font-tabular shrink-0">
          {String(setIndex + 1).padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
            Set {setIndex + 1}
          </div>
          <div className="font-bold text-base truncate">{set.title}</div>
          <div className="text-[11px] text-muted-foreground font-tabular mt-0.5">
            현재 문항 {questionIndexInSet + 1} / {totalInSet} · 첨부{" "}
            {set.attachments.length}개
          </div>
        </div>
      </div>

      {/* 시나리오 · 눈에 잘 띄게 강조 */}
      {set.scenario && (
        <div className="border-l-4 border-warning bg-warning-soft/40 px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-warning text-white flex items-center justify-center text-sm font-bold">
              ⚑
            </div>
            <div className="text-[11px] font-bold tracking-widest text-warning uppercase">
              시나리오 · Scenario
            </div>
          </div>
          <div className="text-[15px] text-foreground whitespace-pre-line leading-[1.8] pl-9">
            {set.scenario}
          </div>
        </div>
      )}

      {/* 첨부 자료 */}
      {set.attachments.length > 0 && (
        <div className="p-4 border-t border-border">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            첨부 자료
          </div>
          <AttachmentViewer
            attachments={set.attachments}
            practiceSlug={slug}
          />
        </div>
      )}
    </div>
  );
}

/* ────── 문항 카드 ────── */

function QuestionCard({
  question,
  answer,
  onChange,
  sessionId,
}: {
  question: Question;
  answer: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sessionId: string | null;
}) {
  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      {/* 큰 문항 헤더 */}
      <div className="px-8 py-5 border-b border-border bg-gradient-to-r from-primary-soft to-white flex items-center gap-4">
        <div className="w-14 h-14 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xl font-tabular shrink-0 shadow-sm">
          {String(question.set_order).padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
            Question · 문제
          </div>
          <div className="font-bold text-lg text-foreground">
            문항 {question.set_order}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-0.5">
            배점
          </div>
          <div className="font-bold text-2xl text-primary font-tabular tabular-nums">
            {question.max_score}
            <span className="text-sm text-muted-foreground font-normal ml-0.5">
              점
            </span>
          </div>
        </div>
      </div>

      {/* 문제 본문 · 읽기 편한 폭 · 큰 폰트 · 넓은 줄간격 */}
      <div className="px-8 py-8">
        <QuestionBody content={question.content} />
      </div>

      {/* 답안 섹션 · 시각적 구분 */}
      <div className="px-8 py-6 border-t-2 border-dashed border-border bg-surface-soft/50">
        <div className="mb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-success text-white flex items-center justify-center font-bold text-sm">
            ✎
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest text-success uppercase mb-0.5">
              Answer · 답안 작성
            </div>
            <div className="text-xs text-muted-foreground">
              {question.submission_slots.length}개 항목 · 자동 저장 (1.5초)
            </div>
          </div>
        </div>
        <SlotEditor
          slots={question.submission_slots}
          values={answer}
          onChange={onChange}
          sessionId={sessionId}
          questionId={question.id}
        />
      </div>
    </div>
  );
}

/**
 * 문제 본문 렌더러 · 가독성 최적화
 * - 문단(빈 줄로 구분) 감지 · 문단 간 공백
 * - 리스트(1./•/-) 자동 인식 · indent
 * - 코드/강조는 지금 텍스트만이라 스킵
 */
function QuestionBody({ content }: { content: string }) {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return (
    <article className="max-w-3xl mx-auto space-y-5 text-[17px] leading-[1.85] text-foreground">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) =>
          /^\s*(\d+\.|[-•·])\s+/.test(l.trim())
        );
        if (isList) {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {lines.map((line, j) => {
                const cleaned = line.replace(/^\s*(\d+\.|[-•·])\s+/, "");
                return (
                  <li key={j} className="flex gap-3">
                    <span className="text-primary font-bold shrink-0 min-w-[1.5rem]">
                      {(line.match(/^\s*(\d+\.|[-•·])/) ?? ["•"])[0].trim()}
                    </span>
                    <span className="flex-1">{cleaned}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </article>
  );
}

type AnswerFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  uploadedAt?: string;
};

function SlotEditor({
  slots,
  values,
  onChange,
  sessionId,
  questionId,
}: {
  slots: Slot[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sessionId: string | null;
  questionId: string;
}) {
  const setValue = (id: string, v: unknown) => {
    onChange({ ...values, [id]: v });
  };

  return (
    <div className="space-y-5">
      {!sessionId && (
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
          답안 (테스트 · 저장되지 않음)
        </div>
      )}
      {slots.map((slot, idx) => {
        const v = values[slot.id];
        return (
          <div key={slot.id}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-tabular text-xs font-bold text-primary tabular-nums">
                  {(idx + 1).toString().padStart(2, "0")}
                </span>
                <span className="font-bold text-sm">{slot.label}</span>
              </div>
              <span className="text-xs font-bold text-muted">
                배점 {slot.max_score}
              </span>
            </div>
            {slot.type === "long_text" && (
              <textarea
                value={(v as string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft resize-none font-tabular"
                placeholder="여기에 작성"
              />
            )}
            {slot.type === "text" && (
              <input
                type="text"
                value={(v as string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="답 입력"
              />
            )}
            {slot.type === "number" && (
              <input
                type="number"
                value={(v as number | string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm font-tabular focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="정수"
              />
            )}
            {slot.type === "url" && (
              <input
                type="url"
                value={(v as string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm font-tabular focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="https://…"
              />
            )}
            {slot.type === "file" && (
              <FileSlot
                slot={slot}
                value={v as AnswerFile | null}
                onChange={(next) => setValue(slot.id, next)}
                sessionId={sessionId}
                questionId={questionId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileSlot({
  slot,
  value,
  onChange,
  sessionId,
  questionId,
}: {
  slot: Slot;
  value: AnswerFile | null;
  onChange: (v: AnswerFile | null) => void;
  sessionId: string | null;
  questionId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!sessionId) {
      setError("Practice에서는 파일 업로드가 저장되지 않습니다");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("questionId", questionId);
      form.append("slotId", slot.id);
      form.append("file", file);
      const res = await fetch("/api/exam/answers/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      onChange(data.file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  if (value?.path) {
    const downloadUrl = `/api/exam/answer-files/${value.path}?download=${encodeURIComponent(value.name)}`;
    return (
      <div className="rounded-md border border-success bg-success-soft/30 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-success text-white flex items-center justify-center text-lg font-bold shrink-0">
          ✓
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{value.name}</div>
          <div className="text-[11px] text-muted-foreground font-tabular">
            {formatSize(value.size)} · 업로드 완료
          </div>
        </div>
        <a
          href={downloadUrl}
          className="h-8 px-3 rounded-sm bg-white border border-border hover:border-primary text-[11px] font-bold transition"
        >
          다운로드
        </a>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="h-8 px-3 rounded-sm bg-white border border-danger text-danger hover:bg-danger-soft text-[11px] font-bold transition"
        >
          삭제
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        className={cn(
          "rounded-md border-2 border-dashed py-6 px-4 text-center text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition",
          busy
            ? "border-border bg-surface-soft text-muted"
            : "border-border-strong bg-surface-soft text-muted-foreground hover:border-primary hover:text-primary"
        )}
      >
        <input
          type="file"
          accept={slot.accept}
          onChange={(e) => void handleFiles(e.target.files)}
          disabled={busy || !sessionId}
          className="hidden"
        />
        <div className="text-2xl">📎</div>
        <div className="font-bold">
          {busy ? "업로드 중…" : "파일 선택 or 드래그"}
        </div>
        {slot.accept && (
          <div className="text-[10px]">허용: {slot.accept}</div>
        )}
        <div className="text-[10px]">최대 50MB · 슬롯당 1개</div>
        {!sessionId && (
          <div className="text-[10px] text-warning font-bold">
            Practice 링크에서는 저장되지 않습니다
          </div>
        )}
      </label>
      {error && (
        <div className="mt-2 text-[11px] text-danger font-bold">{error}</div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
