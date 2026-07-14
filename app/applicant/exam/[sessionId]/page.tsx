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
    const set = new Set<number>();
    mockQuestions.forEach((q, i) => {
      const a = answers[q.id];
      if (!a) return;
      if (
        (q.type === "multiple_choice" && (a as { selected?: string }).selected) ||
        (q.type === "short_answer" && (a as { text?: string }).text?.trim()) ||
        (q.type === "essay" && (a as { text?: string }).text?.trim()) ||
        (q.type === "work_based" && Object.keys(a).length > 0)
      ) {
        set.add(i);
      }
    });
    return set;
  }, [answers]);

  const remainingWarn = remaining < 5 * 60;

  return (
    <div className="flex flex-col min-h-screen">
      <ExamHeader
        title={mockExam.title}
        grade={mockExam.grade}
        applicantName={mockSession.applicantName}
        remaining={remaining}
        remainingWarn={remainingWarn}
        proctoring={mockSession.proctoring}
      />

      <div className="flex flex-1 overflow-hidden">
        <QuestionRail
          questions={mockQuestions}
          currentIdx={currentIdx}
          answered={answered}
          onSelect={setCurrentIdx}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-16 py-14">
            <SetHeading set={currentSet} proctoringDisabled={proctoringDisabled} />
            <QuestionBody
              question={currentQuestion}
              answer={answers[currentQuestion.id]}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [currentQuestion.id]: v }))
              }
            />
            <ExamFooter
              canPrev={currentIdx > 0}
              canNext={currentIdx < mockQuestions.length - 1}
              onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              onNext={() =>
                setCurrentIdx((i) => Math.min(mockQuestions.length - 1, i + 1))
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─────────── 헤더 ─────────── */

function ExamHeader({
  title,
  grade,
  applicantName,
  remaining,
  remainingWarn,
  proctoring,
}: {
  title: string;
  grade: string;
  applicantName: string;
  remaining: number;
  remainingWarn: boolean;
  proctoring: typeof mockSession.proctoring;
}) {
  return (
    <header className="rule-b flex items-center px-8 h-16">
      <Link href="/" className="flex items-center gap-3">
        <span className="text-gold text-base">◆</span>
        <span className="text-[10px] tracking-[0.3em] font-semibold text-primary">
          KBRAIN CERT
        </span>
      </Link>

      <div className="flex-1 flex items-center gap-4 pl-8 min-w-0">
        <span className="text-[10px] tracking-[0.3em] text-gold">
          {grade.replace("(", "· ").replace(")", "")}
        </span>
        <span className="w-1 h-1 rounded-full bg-[--color-line-strong]" />
        <span className="text-sm text-muted-fg truncate">{title}</span>
      </div>

      <div className="mx-8 text-center">
        <div className="text-[9px] tracking-[0.3em] text-muted mb-1">
          REMAINING
        </div>
        <div
          className={cn(
            "font-tabular text-3xl font-bold leading-none",
            remainingWarn ? "text-[--color-danger-strong]" : "text-gold-strong"
          )}
        >
          {formatTime(remaining)}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <ProctorDot label="FACE" state={proctoring.face === "ok" ? "ok" : "err"} />
          <ProctorDot label="MIC" state={proctoring.voice === "ok" ? "ok" : "err"} />
          <ProctorDot label="SCR" state={proctoring.fullscreen === "ok" ? "ok" : "err"} />
          <ProctorDot label="REC" state={proctoring.recording === "recording" ? "rec" : "err"} />
        </div>
        <div className="pl-5 rule-r-none border-l border-[--color-line] pl-5">
          <div className="text-[9px] tracking-[0.3em] text-muted mb-1">
            APPLICANT
          </div>
          <div className="text-sm text-primary font-medium">{applicantName}</div>
        </div>
      </div>
    </header>
  );
}

function ProctorDot({ label, state }: { label: string; state: "ok" | "err" | "rec" }) {
  const color =
    state === "ok"
      ? "bg-[--color-success]"
      : state === "rec"
      ? "bg-[--color-danger]"
      : "bg-[--color-warning]";
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn("w-1.5 h-1.5 rounded-full", color, state === "rec" && "animate-pulse")}
      />
      <span className="text-[8px] tracking-widest text-muted-fg font-tabular">
        {label}
      </span>
    </div>
  );
}

/* ─────────── 좌측 미니멀 rail ─────────── */

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
    <aside className="w-56 rule-r flex flex-col overflow-y-auto">
      <div className="p-6 rule-b">
        <div className="text-[9px] tracking-[0.35em] text-gold mb-2">
          PROGRESS
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-tabular text-3xl font-bold text-primary">
            {answered.size.toString().padStart(2, "0")}
          </span>
          <span className="text-muted-fg text-sm">
            / {questions.length.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="h-px bg-[--color-line] relative">
          <div
            className="absolute inset-y-0 left-0 h-full bg-gold"
            style={{
              width: `${(answered.size / questions.length) * 100}%`,
              backgroundColor: "var(--color-gold)",
            }}
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {mockSets.map((set) => {
          const qs = questions.filter((q) => q.setId === set.id);
          return (
            <div key={set.id}>
              <div className="text-[9px] tracking-[0.3em] text-muted-fg mb-3 flex items-center gap-1.5">
                {set.proctoringDisabled && (
                  <span className="w-1 h-1 rounded-full bg-[--color-warning]" />
                )}
                {set.title.replace(/·.*$/, "")}
              </div>
              <div className="space-y-1">
                {qs.map((q) => {
                  const i = questions.findIndex((qq) => qq.id === q.id);
                  const isCurrent = i === currentIdx;
                  const isAnswered = answered.has(i);
                  return (
                    <button
                      key={q.id}
                      onClick={() => onSelect(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-xs transition group",
                        isCurrent && "bg-gold-muted",
                        !isCurrent && "hover:surface-hover"
                      )}
                    >
                      <span
                        className={cn(
                          "font-tabular font-bold w-6 text-left",
                          isCurrent
                            ? "text-gold-strong"
                            : isAnswered
                            ? "text-primary"
                            : "text-muted"
                        )}
                      >
                        {q.index.toString().padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "flex-1 text-left truncate",
                          isCurrent ? "text-primary" : "text-muted-fg"
                        )}
                      >
                        {questionTypeLabel(q.type)}
                      </span>
                      <span
                        className={cn(
                          "w-1 h-1 rounded-full",
                          isAnswered
                            ? "bg-gold"
                            : "bg-[--color-line-strong] opacity-30"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="rule-t-gold pt-3 mt-6 text-[10px] leading-relaxed">
          <div className="flex items-center gap-1.5 mb-1 text-gold">
            <span className="w-1 h-1 rounded-full bg-[--color-warning]" />
            <span className="tracking-widest">WAIVED SET</span>
          </div>
          <div className="text-muted-fg pl-2.5">
            외부 도구 사용이 허용된 구간
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─────────── 세트 헤딩 (배너 대체) ─────────── */

function SetHeading({
  set,
  proctoringDisabled,
}: {
  set: typeof mockSets[number] | undefined;
  proctoringDisabled: boolean;
}) {
  if (!set) return null;

  if (proctoringDisabled) {
    return (
      <div className="mb-12 flex items-start gap-6 py-6 rule-t-gold rule-b-gold">
        <div className="gutter-numeral text-4xl text-[--color-warning] flex-shrink-0">
          !
        </div>
        <div>
          <div className="text-[10px] tracking-[0.4em] text-[--color-warning] font-semibold mb-2">
            PROCTORING WAIVED · SET LEVEL
          </div>
          <div className="text-lg font-serif text-primary mb-2">
            이 구간은 외부 도구 사용이 허용됩니다.
          </div>
          <div className="text-sm text-muted-fg leading-relaxed">
            전체화면 이탈 · 얼굴 · 음성 감지가 이 문제 세트 동안 일시 중지됩니다.
            다른 세트 문제로 이동하면 감독이 자동 재활성화됩니다.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-10 py-4">
      <div className="text-[10px] tracking-[0.35em] text-gold mb-1.5 font-semibold">
        {set.title.replace(/·.*$/, "")}
      </div>
      {set.scenario && (
        <div className="text-sm text-muted-fg font-serif">{set.scenario}</div>
      )}
    </div>
  );
}

/* ─────────── 문제 (카드 없이) ─────────── */

function QuestionBody({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="relative">
      {/* 배경에 거대 문항 번호 */}
      <div
        aria-hidden
        className="absolute -top-14 -left-14 gutter-numeral leading-none pointer-events-none select-none"
        style={{ fontSize: "220px", opacity: 0.35 }}
      >
        {question.index.toString().padStart(2, "0")}
      </div>

      <div className="relative">
        <div className="flex items-baseline gap-5 mb-8">
          <span className="text-[10px] tracking-[0.35em] text-gold font-semibold">
            QUESTION {question.index.toString().padStart(2, "0")}
          </span>
          <span className="w-1 h-1 rounded-full bg-[--color-line-strong]" />
          <span className="text-[10px] tracking-[0.3em] text-muted uppercase">
            {questionTypeLabel(question.type)}
          </span>
          <span className="w-1 h-1 rounded-full bg-[--color-line-strong]" />
          <span className="text-[10px] font-tabular text-muted-fg tracking-wider">
            배점 {question.maxScore}
          </span>
        </div>

        <div className="font-serif text-xl leading-[1.7] text-primary mb-10 whitespace-pre-line">
          {question.content}
        </div>

        {question.policy && (
          <div className="mb-8 text-xs tracking-widest text-[--color-warning] py-2 rule-t-gold rule-b-gold px-1">
            {question.policy}
          </div>
        )}

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
      <div className="divide-y divide-[--color-line]">
        {question.options?.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange({ selected: opt.id })}
              className={cn(
                "w-full text-left flex gap-6 items-center py-5 transition group",
                active ? "text-primary" : "text-muted-fg hover:text-primary"
              )}
            >
              <div
                className={cn(
                  "font-tabular text-lg font-bold w-8 flex-shrink-0 transition",
                  active ? "text-gold-strong" : "group-hover:text-gold"
                )}
              >
                {opt.id.toUpperCase()}
              </div>
              <div className="text-base font-serif flex-1 leading-relaxed">
                {opt.text}
              </div>
              <div className="flex-shrink-0">
                {active ? (
                  <span className="text-gold text-lg">◆</span>
                ) : (
                  <span className="text-[--color-line-strong] text-lg group-hover:text-gold transition">
                    ◇
                  </span>
                )}
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
      <div className="pt-4">
        <div className="text-[9px] tracking-[0.35em] text-gold mb-3 font-semibold">
          ANSWER
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="답을 입력하세요"
          className="w-full bg-transparent border-b-2 border-[--color-line-strong] focus:border-gold focus:outline-none py-3 font-tabular text-2xl text-primary placeholder:text-muted transition"
        />
      </div>
    );
  }

  if (question.type === "essay") {
    const text = (answer as { text?: string })?.text ?? "";
    return (
      <div className="pt-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[9px] tracking-[0.35em] text-gold font-semibold">
            ANSWER
          </div>
          <div className="text-[10px] font-tabular text-muted-fg">
            {text.length}자
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="여기에 서술하세요."
          rows={9}
          className="w-full bg-[--color-surface-elevated] border-l-2 border-[--color-line-strong] focus:border-gold focus:outline-none px-6 py-4 text-base font-serif leading-relaxed text-primary placeholder:text-muted resize-y transition"
        />
      </div>
    );
  }

  if (question.type === "work_based") {
    const slots = (answer as Record<string, unknown>) ?? {};
    return (
      <div className="pt-4 space-y-8">
        <div className="text-[9px] tracking-[0.35em] text-gold font-semibold">
          SUBMISSION SLOTS
        </div>
        {question.slots?.map((slot, idx) => (
          <div key={slot.id}>
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-tabular text-lg font-bold text-gold-strong w-6">
                  {(idx + 1).toString().padStart(2, "0")}
                </span>
                <label className="text-sm font-semibold text-primary">
                  {slot.label}
                </label>
              </div>
              <span className="text-[10px] font-tabular text-muted-fg tracking-wider">
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
                className="w-full bg-[--color-surface-elevated] border-l-2 border-[--color-line] focus:border-gold focus:outline-none px-4 py-3 text-sm font-tabular text-primary resize-y transition"
              />
            ) : slot.type === "file" ? (
              <div className="border-l-2 border-dashed border-[--color-line-strong] hover:border-gold px-6 py-8 text-sm text-muted-fg hover:text-primary transition cursor-pointer group">
                <div className="text-[10px] tracking-[0.3em] text-gold group-hover:text-gold-strong mb-1">
                  UPLOAD
                </div>
                파일을 드래그하거나 클릭하여 업로드
                <div className="text-[10px] mt-1 text-muted">
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
                className="w-full bg-transparent border-b border-[--color-line-strong] focus:border-gold focus:outline-none py-2 text-base font-tabular text-primary transition"
              />
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/* ─────────── 하단 액션 ─────────── */

function ExamFooter({
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-16 pt-8 rule-t-gold flex items-center gap-3 justify-between">
      <button
        disabled={!canPrev}
        onClick={onPrev}
        className={cn(
          "px-6 h-11 text-xs tracking-[0.3em] font-semibold transition",
          canPrev
            ? "text-primary hover:text-gold"
            : "text-muted cursor-not-allowed"
        )}
      >
        ← PREV
      </button>
      <div className="flex items-center gap-3">
        <button className="px-6 h-11 text-xs tracking-[0.3em] font-semibold text-primary hover:text-gold transition">
          SAVE
        </button>
        {canNext ? (
          <button
            onClick={onNext}
            className="px-8 h-11 bg-gold text-[--color-primary-foreground] text-xs tracking-[0.3em] font-bold hover:bg-gold-strong transition"
            style={{
              backgroundColor: "var(--color-gold)",
              color: "var(--color-primary-foreground)",
            }}
          >
            NEXT →
          </button>
        ) : (
          <button className="px-8 h-11 bg-[--color-danger] text-white text-xs tracking-[0.3em] font-bold hover:bg-[--color-danger-strong] transition">
            SUBMIT
          </button>
        )}
      </div>
    </div>
  );
}

function questionTypeLabel(t: Question["type"]) {
  switch (t) {
    case "multiple_choice":
      return "MULTIPLE CHOICE";
    case "short_answer":
      return "SHORT ANSWER";
    case "essay":
      return "ESSAY";
    case "work_based":
      return "WORK BASED";
  }
}
