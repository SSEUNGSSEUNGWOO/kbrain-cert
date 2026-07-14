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
        <div className="border-b border-[--color-border]">
          <div className="mx-auto max-w-6xl px-6 py-3 rounded-none">
            <div className="rounded-2xl bg-[--color-orange-soft] px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[--color-orange] text-white flex items-center justify-center text-lg">
                ⚙️
              </div>
              <div className="text-sm text-[--color-orange]">
                <span className="font-bold">감독 일시 비활성 구간</span> · 이 문제
                세트는 외부 도구 사용이 허용됩니다. 얼굴·음성·전체화면 감지가 중지
                되며, 다른 세트로 이동 시 자동 재활성화됩니다.
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
          onSelect={setCurrentIdx}
        />

        <main className="flex-1 min-w-0">
          <QuestionCard
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onChange={(v) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: v }))
            }
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="h-12 px-5 rounded-2xl bg-white shadow-[var(--shadow-card)] text-sm font-bold hover:bg-[--color-surface-hover] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← 이전 문항
            </button>
            {currentIdx < mockQuestions.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentIdx((i) => Math.min(mockQuestions.length - 1, i + 1))
                }
                className="h-12 px-6 rounded-2xl bg-[--color-primary] hover:bg-[--color-primary-hover] text-white text-sm font-bold shadow-[var(--shadow-card)] transition"
              >
                다음 문항 →
              </button>
            ) : (
              <button className="h-12 px-6 rounded-2xl bg-[--color-red] hover:opacity-90 text-white text-sm font-bold shadow-[var(--shadow-card)] transition">
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
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-[--color-border]">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[--color-primary] text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-muted]">
              KBRAIN CERT · 응시
            </div>
            <div className="font-bold text-sm truncate max-w-md">{title}</div>
          </div>
        </Link>

        <div
          className={cn(
            "flex flex-col items-center px-5 py-1.5 rounded-2xl border-2",
            remainingWarn
              ? "border-[--color-red] bg-[--color-red-soft]"
              : "border-[--color-primary-soft] bg-[--color-primary-soft]"
          )}
        >
          <div
            className={cn(
              "text-[9px] font-bold tracking-[0.15em]",
              remainingWarn ? "text-[--color-red]" : "text-[--color-primary]"
            )}
          >
            남은 시간
          </div>
          <div
            className={cn(
              "font-tabular text-2xl font-bold leading-none",
              remainingWarn ? "text-[--color-red]" : "text-[--color-primary]"
            )}
          >
            {formatTime(remaining)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-muted]">
              응시자
            </div>
            <div className="font-bold text-sm">{applicantName}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[--color-purple] to-[--color-pink] text-white flex items-center justify-center text-xs font-bold">
            {applicantName.slice(0, 1)}
          </div>
        </div>
      </div>
      <div className="h-1 bg-[--color-subtle]">
        <div
          className={cn(
            "h-full transition-all",
            remainingWarn ? "bg-[--color-red]" : "bg-[--color-primary]"
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
    <div className="border-b border-[--color-border] bg-[--color-surface-soft]">
      <div className="mx-auto max-w-6xl px-6 py-2.5 flex items-center gap-4">
        <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-muted]">
          감독 상태
        </div>
        <ProctorPill label="얼굴 감지" ok={proctoring.face === "ok"} icon="👤" />
        <ProctorPill label="음성" ok={proctoring.voice === "ok"} icon="🎤" />
        <ProctorPill label="전체화면" ok={proctoring.fullscreen === "ok"} icon="🖥" />
        <ProctorPill
          label="녹화 중"
          ok={proctoring.recording === "recording"}
          icon="🔴"
          recording
        />
      </div>
    </div>
  );
}

function ProctorPill({
  label,
  ok,
  icon,
  recording = false,
}: {
  label: string;
  ok: boolean;
  icon: string;
  recording?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
        recording && ok
          ? "bg-[--color-red-soft] text-[--color-red]"
          : ok
          ? "bg-[--color-emerald-soft] text-[--color-emerald]"
          : "bg-[--color-orange-soft] text-[--color-orange]"
      )}
    >
      <span>{icon}</span>
      {label}
      {recording && ok && (
        <span className="w-1.5 h-1.5 rounded-full bg-[--color-red] animate-pulse ml-0.5" />
      )}
    </div>
  );
}

/* ────── Question Rail ────── */

function QuestionRail({
  questions,
  currentIdx,
  answered,
  onSelect,
}: {
  questions: Question[];
  currentIdx: number;
  answered: Set<number>;
  onSelect: (i: number) => void;
}) {
  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-32 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-xs font-bold tracking-widest text-[--color-muted]">
            진행 현황
          </div>
          <div className="text-xs font-bold text-[--color-primary] font-tabular">
            {answered.size}/{questions.length}
          </div>
        </div>

        <div className="mb-5">
          <div className="h-2 bg-[--color-subtle] rounded-full overflow-hidden">
            <div
              className="h-full bg-[--color-primary] rounded-full transition-all"
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
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest">
                  {set.proctoringDisabled ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[--color-orange]" />
                      <span className="text-[--color-orange]">외부도구 허용</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[--color-primary]" />
                      <span className="text-[--color-muted-foreground]">감독 활성</span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {qs.map((q) => {
                    const i = questions.findIndex((qq) => qq.id === q.id);
                    const isCurrent = i === currentIdx;
                    const isAnswered = answered.has(i);
                    return (
                      <button
                        key={q.id}
                        onClick={() => onSelect(i)}
                        className={cn(
                          "aspect-square rounded-lg text-xs font-bold tabular-nums transition",
                          isCurrent
                            ? "bg-[--color-primary] text-white scale-110 shadow-[var(--shadow-card)]"
                            : isAnswered
                            ? "bg-[--color-primary-soft] text-[--color-primary]"
                            : "bg-[--color-surface-soft] text-[--color-muted] hover:bg-[--color-subtle]"
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
      </div>
    </aside>
  );
}

/* ────── Question Card ────── */

const TYPE_STYLE: Record<
  Question["type"],
  { label: string; tone: string; icon: string }
> = {
  multiple_choice: {
    label: "객관식",
    tone: "bg-[--color-primary-soft] text-[--color-primary]",
    icon: "◉",
  },
  short_answer: {
    label: "단답형",
    tone: "bg-[--color-emerald-soft] text-[--color-emerald]",
    icon: "≡",
  },
  essay: {
    label: "서술형",
    tone: "bg-[--color-purple-soft] text-[--color-purple]",
    icon: "✎",
  },
  work_based: {
    label: "작업형",
    tone: "bg-[--color-orange-soft] text-[--color-orange]",
    icon: "🔧",
  },
};

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: unknown;
  onChange: (v: unknown) => void;
}) {
  const t = TYPE_STYLE[question.type];
  return (
    <div className="rounded-3xl bg-white shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-8 pt-6 pb-4 border-b border-[--color-border] flex items-center gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-[--color-primary] text-white flex items-center justify-center text-sm font-bold tabular-nums">
          Q{question.index}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-md",
            t.tone
          )}
        >
          {t.icon} {t.label}
        </span>
        <span className="text-xs font-bold text-[--color-muted]">
          배점 {question.maxScore}점
        </span>
        <div className="ml-auto">
          <button className="inline-flex items-center gap-1 rounded-lg bg-[--color-surface-soft] text-xs font-bold text-[--color-muted-foreground] px-3 py-1.5 hover:bg-[--color-yellow-soft] hover:text-[--color-yellow] transition">
            🔖 검토 표시
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {question.type === "work_based" && (
          <div className="mb-5 rounded-2xl bg-gradient-to-br from-[--color-orange-soft] to-[--color-yellow-soft] p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[--color-orange] text-white flex items-center justify-center text-xl shrink-0">
                🔓
              </div>
              <div className="text-sm text-[--color-orange]">
                <div className="font-bold mb-1">
                  작업형 · 외부 도구 사용 가능
                </div>
                <div className="text-xs leading-relaxed">
                  Claude · GPT · IDE · CLI 등 자유 사용 · 전체화면 이탈 자유 · 서버
                  기준 마감 시각은 계속 흐릅니다
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="text-base leading-relaxed whitespace-pre-line text-[--color-foreground]">
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
      <div className="space-y-2.5">
        {question.options?.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange({ selected: opt.id })}
              className={cn(
                "w-full text-left px-5 py-4 rounded-2xl border-2 transition",
                active
                  ? "border-[--color-primary] bg-[--color-primary-soft]"
                  : "border-[--color-border] bg-white hover:border-[--color-primary]"
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
                    active
                      ? "bg-[--color-primary] text-white"
                      : "bg-[--color-surface-soft] text-[--color-muted]"
                  )}
                >
                  {opt.id.toUpperCase()}
                </div>
                <div
                  className={cn(
                    "flex-1 text-base",
                    active
                      ? "font-bold text-[--color-primary]"
                      : "text-[--color-foreground]"
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
        className="w-full min-h-32 rounded-2xl border-2 border-[--color-border] bg-white px-5 py-4 text-base focus:border-[--color-primary] focus:outline-none focus:ring-4 focus:ring-[--color-primary-soft] resize-none"
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
          className="w-full rounded-2xl border-2 border-[--color-border] bg-white px-5 py-4 text-base focus:border-[--color-purple] focus:outline-none focus:ring-4 focus:ring-[--color-purple-soft] resize-y"
          placeholder="여기에 서술하세요 (200~300자 권장)"
        />
        <div className="mt-2 flex justify-end text-xs font-bold text-[--color-muted-foreground] font-tabular">
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
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[--color-orange] text-white text-xs font-bold flex items-center justify-center tabular-nums">
                  {idx + 1}
                </span>
                <span className="font-bold text-sm">{slot.label}</span>
                <span className="text-[10px] font-bold text-[--color-red]">
                  필수
                </span>
              </div>
              <span className="text-xs font-bold text-[--color-muted]">
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
                className="w-full rounded-2xl border-2 border-[--color-border] bg-white px-5 py-4 text-sm focus:border-[--color-orange] focus:outline-none focus:ring-4 focus:ring-[--color-orange-soft] resize-none font-tabular"
                placeholder="여기에 작성하세요"
              />
            ) : slot.type === "file" ? (
              <div className="rounded-2xl border-2 border-dashed border-[--color-border-strong] bg-[--color-surface-soft] hover:border-[--color-orange] hover:bg-[--color-orange-soft] p-8 text-center cursor-pointer transition">
                <div className="text-4xl mb-2">📎</div>
                <div className="text-sm font-bold text-[--color-foreground]">
                  파일 드래그 또는 클릭 업로드
                </div>
                <div className="text-xs text-[--color-muted-foreground] mt-1">
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
                className="w-full rounded-2xl border-2 border-[--color-border] bg-white px-5 py-3 text-sm focus:border-[--color-orange] focus:outline-none focus:ring-4 focus:ring-[--color-orange-soft]"
              />
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
}
