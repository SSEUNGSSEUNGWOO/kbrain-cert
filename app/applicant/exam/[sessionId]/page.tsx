"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  mockExam,
  mockQuestions,
  mockSets,
  mockSession,
  type Question,
} from "@/lib/mock";
import { cn, formatTime } from "@/lib/utils";

export default function ExamPage() {
  const [currentIdx, setCurrentIdx] = useState(mockSession.currentQuestionIndex);
  const [remaining, setRemaining] = useState(mockSession.remainingSeconds);
  const [answers, setAnswers] = useState(mockSession.answers);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const currentQuestion = mockQuestions[currentIdx];
  const currentSet = mockSets.find((s) => s.id === currentQuestion.setId);
  const proctoringDisabled = currentSet?.proctoringDisabled ?? false;

  const answered = useMemo(() => {
    const s = new Set<number>();
    mockQuestions.forEach((q, i) => {
      const a = answers[q.id];
      if (!a) return;
      if (
        (q.type === "multiple_choice" && (a as { selected?: string }).selected) ||
        (q.type === "short_answer" && (a as { text?: string }).text?.trim()) ||
        (q.type === "essay" && (a as { text?: string }).text?.trim()) ||
        (q.type === "work_based" && Object.keys(a).length > 0)
      ) {
        s.add(i);
      }
    });
    return s;
  }, [answers]);

  const remainingWarn = remaining < 5 * 60;
  const totalSeconds = mockExam.durationMinutes * 60;
  const progressPct = ((totalSeconds - remaining) / totalSeconds) * 100;

  const toggleFlag = (id: string) =>
    setFlagged((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="min-h-screen flex flex-col">
      <ExamHeader
        title={mockExam.title}
        applicantName={mockSession.applicantName}
        remaining={remaining}
        remainingWarn={remainingWarn}
        progressPct={progressPct}
      />

      <ProctorStrip proctoring={mockSession.proctoring} />

      {proctoringDisabled && (
        <div className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-3">
            <div className="border-l-2 border-warning bg-warning-soft/40 px-5 py-3">
              <div className="text-[10px] font-bold tracking-[0.25em] text-warning uppercase mb-1">
                Proctoring Waived · Set Level
              </div>
              <div className="text-sm text-foreground leading-relaxed">
                <span className="font-bold">감독 일시 비활성 구간</span> · 이 문제 세트는 외부 도구 사용이 허용됩니다. 얼굴·음성·전체화면 감지가 중지되며, 다른 세트로 이동 시 자동 재활성화됩니다.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 mx-auto max-w-6xl w-full px-6 py-6 flex gap-6">
        <QuestionRail
          questions={mockQuestions}
          currentIdx={currentIdx}
          answered={answered}
          flagged={flagged}
          onSelect={setCurrentIdx}
        />

        <main className="flex-1 min-w-0">
          <QuestionCard
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            flagged={flagged.has(currentQuestion.id)}
            onToggleFlag={() => toggleFlag(currentQuestion.id)}
            onChange={(v) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: v }))
            }
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="h-11 px-5 rounded-md bg-white border border-border text-sm font-bold hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← 이전 문항
            </button>
            {currentIdx < mockQuestions.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentIdx((i) => Math.min(mockQuestions.length - 1, i + 1))
                }
                className="h-11 px-6 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold transition"
              >
                다음 문항 →
              </button>
            ) : (
              <button className="h-11 px-6 rounded-md bg-danger hover:opacity-90 text-white text-sm font-bold transition">
                최종 제출
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ────── Header ────── */

function ExamHeader({
  title,
  applicantName,
  remaining,
  remainingWarn,
  progressPct,
}: {
  title: string;
  applicantName: string;
  remaining: number;
  remainingWarn: boolean;
  progressPct: number;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
            k
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
              Kbrain Cert · Exam
            </div>
            <div className="font-bold text-sm truncate">{title}</div>
          </div>
        </Link>

        <div
          className={cn(
            "flex flex-col items-center px-5 py-1.5 rounded-md border",
            remainingWarn
              ? "border-danger bg-danger-soft"
              : "border-border-strong bg-white"
          )}
        >
          <div
            className={cn(
              "text-[9px] font-bold tracking-[0.2em] uppercase",
              remainingWarn ? "text-danger" : "text-muted"
            )}
          >
            Remaining
          </div>
          <div
            className={cn(
              "font-tabular text-2xl font-bold leading-none",
              remainingWarn ? "text-danger" : "text-primary"
            )}
          >
            {formatTime(remaining)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
              Applicant
            </div>
            <div className="font-bold text-sm">{applicantName}</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center text-xs font-bold">
            {applicantName.slice(0, 1)}
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-subtle">
        <div
          className={cn(
            "h-full transition-all",
            remainingWarn ? "bg-danger" : "bg-primary"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>
  );
}

function ProctorStrip({
  proctoring,
}: {
  proctoring: typeof mockSession.proctoring;
}) {
  return (
    <div className="border-b border-border bg-surface-soft">
      <div className="mx-auto max-w-6xl px-6 py-2 flex items-center gap-5">
        <div className="text-[10px] font-bold tracking-[0.25em] text-muted uppercase">
          Proctoring
        </div>
        <ProctorPill label="FACE" ok={proctoring.face === "ok"} />
        <ProctorPill label="MIC" ok={proctoring.voice === "ok"} />
        <ProctorPill label="FULLSCREEN" ok={proctoring.fullscreen === "ok"} />
        <ProctorPill
          label="REC"
          ok={proctoring.recording === "recording"}
          recording
        />
      </div>
    </div>
  );
}

function ProctorPill({
  label,
  ok,
  recording = false,
}: {
  label: string;
  ok: boolean;
  recording?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest",
        recording && ok
          ? "bg-danger-soft text-danger"
          : ok
          ? "bg-success-soft text-success"
          : "bg-warning-soft text-warning"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          recording && ok
            ? "bg-danger animate-pulse"
            : ok
            ? "bg-success"
            : "bg-warning"
        )}
      />
      {label}
    </div>
  );
}

/* ────── Question Rail ────── */

function QuestionRail({
  questions,
  currentIdx,
  answered,
  flagged,
  onSelect,
}: {
  questions: Question[];
  currentIdx: number;
  answered: Set<number>;
  flagged: Set<string>;
  onSelect: (i: number) => void;
}) {
  return (
    <aside className="w-60 shrink-0">
      <div className="sticky top-32 rounded-md bg-white border border-border p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] font-bold tracking-[0.25em] text-muted uppercase">
            Progress
          </div>
          <div className="text-xs font-bold text-primary font-tabular">
            {answered.size}/{questions.length}
          </div>
        </div>

        <div className="mb-5">
          <div className="h-1 bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(answered.size / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {mockSets.map((set) => {
            const qs = questions.filter((q) => q.setId === set.id);
            return (
              <div key={set.id}>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase">
                  {set.proctoringDisabled ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                      <span className="text-warning">Waived Set</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Proctored</span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {qs.map((q) => {
                    const i = questions.findIndex((qq) => qq.id === q.id);
                    const isCurrent = i === currentIdx;
                    const isAnswered = answered.has(i);
                    const isFlagged = flagged.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => onSelect(i)}
                        className={cn(
                          "relative aspect-square rounded-sm text-xs font-bold tabular-nums transition",
                          isCurrent
                            ? "bg-primary text-white ring-2 ring-primary-soft"
                            : isFlagged
                            ? "bg-warning-soft text-warning ring-1 ring-warning"
                            : isAnswered
                            ? "bg-primary-soft text-primary"
                            : "bg-surface-soft text-muted hover:bg-subtle"
                        )}
                      >
                        {q.index}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-border space-y-1.5 text-[10px]">
          <LegendRow color="bg-surface-soft" label="미응답" />
          <LegendRow color="bg-primary-soft" label="응답 완료" />
          <LegendRow color="bg-warning-soft" label="검토 표시" />
          <LegendRow color="bg-primary" label="현재 문항" />
        </div>
      </div>
    </aside>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className={cn("w-3 h-3 rounded-sm", color)} />
      {label}
    </div>
  );
}

/* ────── Question Card ────── */

const TYPE_LABEL: Record<Question["type"], string> = {
  multiple_choice: "MULTIPLE CHOICE",
  short_answer: "SHORT ANSWER",
  essay: "ESSAY",
  work_based: "WORK BASED",
};

function QuestionCard({
  question,
  answer,
  flagged,
  onToggleFlag,
  onChange,
}: {
  question: Question;
  answer: unknown;
  flagged: boolean;
  onToggleFlag: () => void;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      <div className="px-8 py-4 border-b border-border bg-surface-soft flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center text-sm font-bold tabular-nums">
          Q{question.index}
        </div>
        <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
          {TYPE_LABEL[question.type]}
        </div>
        <div className="text-xs font-bold text-muted-foreground">
          배점 {question.maxScore}점
        </div>
        <div className="ml-auto">
          <button
            onClick={onToggleFlag}
            className={cn(
              "text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-sm transition",
              flagged
                ? "bg-warning-soft text-warning"
                : "text-muted-foreground hover:bg-surface-hover"
            )}
          >
            {flagged ? "★ 검토 표시됨" : "☆ 검토 표시"}
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {question.type === "work_based" && (
          <div className="mb-5 border-l-2 border-warning bg-warning-soft/40 px-4 py-3 rounded-sm">
            <div className="text-[10px] font-bold text-warning tracking-[0.25em] uppercase mb-1">
              External Tools Allowed
            </div>
            <div className="text-sm text-foreground leading-relaxed">
              <span className="font-bold">작업형 · 외부 도구 사용 가능</span> · Claude · GPT · IDE · CLI 등 자유 사용 · 전체화면 이탈 자유 · 서버 기준 마감 시각은 계속 흐릅니다
            </div>
          </div>
        )}
        <div className="text-[15px] leading-relaxed whitespace-pre-line text-foreground">
          {question.content}
        </div>
      </div>

      <div className="px-8 pb-8">
        <AnswerBody question={question} answer={answer} onChange={onChange} />
      </div>
    </div>
  );
}

function AnswerBody({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "multiple_choice") {
    const selected = (answer as { selected?: string })?.selected;
    return (
      <div className="space-y-2">
        {question.options?.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange({ selected: opt.id })}
              className={cn(
                "w-full text-left px-5 py-3.5 rounded-md border transition",
                active
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-white hover:border-primary"
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-8 h-8 rounded-sm flex items-center justify-center font-bold text-sm shrink-0",
                    active
                      ? "bg-primary text-white"
                      : "bg-surface-soft text-muted"
                  )}
                >
                  {opt.id.toUpperCase()}
                </div>
                <div
                  className={cn(
                    "flex-1 text-sm",
                    active
                      ? "font-bold text-primary"
                      : "text-foreground"
                  )}
                >
                  {opt.text}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "short_answer") {
    const text = (answer as { text?: string })?.text ?? "";
    return (
      <textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        className="w-full min-h-32 rounded-md border border-border bg-white px-5 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft resize-none"
        placeholder="답변을 입력하세요"
      />
    );
  }

  if (question.type === "essay") {
    const text = (answer as { text?: string })?.text ?? "";
    return (
      <div>
        <textarea
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={8}
          className="w-full rounded-md border border-border bg-white px-5 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft resize-y"
          placeholder="여기에 서술하세요 (200~300자 권장)"
        />
        <div className="mt-2 flex justify-end text-xs font-bold text-muted-foreground font-tabular">
          {text.length}자
        </div>
      </div>
    );
  }

  if (question.type === "work_based") {
    const slots = (answer as Record<string, unknown>) ?? {};
    return (
      <div className="space-y-5">
        {question.slots?.map((slot, idx) => (
          <div key={slot.id}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-tabular text-xs font-bold text-primary tabular-nums">
                  {(idx + 1).toString().padStart(2, "0")}
                </span>
                <span className="font-bold text-sm">{slot.label}</span>
                <span className="text-[10px] font-bold text-danger tracking-widest uppercase">
                  Required
                </span>
              </div>
              <span className="text-xs font-bold text-muted">
                배점 {slot.maxScore}
              </span>
            </div>
            {slot.type === "long_text" ? (
              <textarea
                value={(slots[slot.id] as string) ?? ""}
                onChange={(e) =>
                  onChange({ ...slots, [slot.id]: e.target.value })
                }
                rows={4}
                className="w-full rounded-md border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft resize-none font-tabular"
                placeholder="여기에 작성하세요"
              />
            ) : slot.type === "file" ? (
              <div className="rounded-md border-2 border-dashed border-border-strong bg-surface-soft hover:border-primary hover:bg-primary-soft py-8 text-center cursor-pointer transition">
                <div className="text-[10px] font-bold tracking-[0.25em] text-primary uppercase mb-1">
                  Upload
                </div>
                <div className="text-sm font-bold text-foreground">
                  파일 드래그 또는 클릭 업로드
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  .py, .ipynb, .zip · 최대 20MB
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={(slots[slot.id] as string) ?? ""}
                onChange={(e) =>
                  onChange({ ...slots, [slot.id]: e.target.value })
                }
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
              />
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
}
