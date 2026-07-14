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
    <div className="flex flex-col min-h-screen relative">
      <ExamHeader
        title={mockExam.title}
        grade={mockExam.grade}
        applicantName={mockSession.applicantName}
        remaining={remaining}
        remainingWarn={remainingWarn}
        proctoring={mockSession.proctoring}
      />

      <div className="flex flex-1 overflow-hidden">
        <QuestionSidebar
          questions={mockQuestions}
          currentIdx={currentIdx}
          answered={answered}
          onSelect={setCurrentIdx}
        />

        <main className="flex-1 overflow-y-auto surface-muted">
          <div className="max-w-3xl mx-auto p-10">
            <SetBanner set={currentSet} proctoringDisabled={proctoringDisabled} />
            <QuestionCard
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

/* ─────────── 상단 헤더 ─────────── */

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
    <header className="border-b border-strong bg-white flex items-center px-6 h-14 z-10">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="text-xs font-semibold tracking-widest text-muted-fg hover:text-primary"
        >
          kbrain-cert
        </Link>
        <span className="text-muted">|</span>
        <span className="text-sm font-medium text-primary truncate">{title}</span>
        <span className="inline-flex items-center h-6 px-2 rounded-sm bg-primary text-primary-foreground text-[10px] font-semibold tracking-wider">
          {grade}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-col items-center px-8 py-1 rounded-md border transition",
          remainingWarn
            ? "border-[--color-danger] bg-[--color-danger-muted]"
            : "border-[--color-border-strong] bg-white"
        )}
      >
        <span className="text-[10px] text-muted-fg tracking-widest">남은 시간</span>
        <span
          className={cn(
            "font-tabular text-xl font-bold leading-none",
            remainingWarn ? "text-[--color-danger]" : "text-primary"
          )}
        >
          {formatTime(remaining)}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <ProctorDot label="얼굴" state={proctoring.face === "ok" ? "ok" : "err"} />
          <ProctorDot label="음성" state={proctoring.voice === "ok" ? "ok" : "err"} />
          <ProctorDot
            label="화면"
            state={proctoring.fullscreen === "ok" ? "ok" : "err"}
          />
          <ProctorDot
            label="녹화"
            state={proctoring.recording === "recording" ? "rec" : "err"}
          />
        </div>
        <div className="text-sm text-primary font-medium">{applicantName}</div>
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
    <div className="flex items-center gap-1.5">
      <span
        className={cn("w-1.5 h-1.5 rounded-full", color, state === "rec" && "animate-pulse")}
      />
      <span className="text-[10px] text-muted-fg tracking-wider">{label}</span>
    </div>
  );
}

/* ─────────── 좌측 문제 그리드 ─────────── */

function QuestionSidebar({
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
    <aside className="w-60 border-r border-[--color-border] bg-white overflow-y-auto p-5 space-y-6">
      <div>
        <div className="text-[10px] font-semibold tracking-widest text-muted-fg mb-2">
          문제 진행 현황
        </div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-primary font-medium">
            {answered.size} / {questions.length}
          </span>
          <span className="font-tabular text-muted-fg">
            {Math.round((answered.size / questions.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-1 bg-[--color-subtle] rounded-sm overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(answered.size / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {mockSets.map((set) => {
        const qs = questions.filter((q) => q.setId === set.id);
        return (
          <div key={set.id}>
            <div className="text-[10px] font-semibold text-muted-fg mb-2 tracking-wider flex items-center gap-1.5">
              {set.proctoringDisabled && (
                <span className="w-1 h-1 rounded-full bg-[--color-warning]" />
              )}
              {set.title}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {qs.map((q) => {
                const i = questions.findIndex((qq) => qq.id === q.id);
                const isCurrent = i === currentIdx;
                const isAnswered = answered.has(i);
                return (
                  <button
                    key={q.id}
                    onClick={() => onSelect(i)}
                    className={cn(
                      "aspect-square rounded-sm text-xs font-tabular font-medium border transition",
                      isCurrent && "bg-primary text-primary-foreground border-primary",
                      !isCurrent && isAnswered
                        ? "bg-[--color-accent-muted] border-[--color-accent] text-[--color-accent]"
                        : !isCurrent &&
                            "bg-white border-[--color-border] text-muted-fg hover:border-[--color-border-strong] hover:text-primary"
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

      <div className="pt-4 border-t border-[--color-border] text-[10px] leading-relaxed text-muted-fg">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1 h-1 rounded-full bg-[--color-warning]" />
          <span>감독 비활성 세트</span>
        </div>
        <div className="pl-2.5">외부 도구 사용이 허용된 구간</div>
      </div>
    </aside>
  );
}

/* ─────────── 세트 배너 (핵심 이슈 #1 시각화) ─────────── */

function SetBanner({
  set,
  proctoringDisabled,
}: {
  set: typeof mockSets[number] | undefined;
  proctoringDisabled: boolean;
}) {
  if (!set) return null;

  if (proctoringDisabled) {
    return (
      <div className="mb-6 border-l-2 border-[--color-warning] bg-[--color-warning-muted] px-5 py-4 rounded-r-md">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold tracking-widest text-[--color-warning] uppercase">
            감독 일시 비활성 · Set Level Waiver
          </span>
        </div>
        <div className="text-sm text-primary font-medium mb-1">
          이 구간은 외부 도구 사용이 허용됩니다.
        </div>
        <div className="text-xs text-muted-fg leading-relaxed">
          전체화면 이탈 · 얼굴 · 음성 감지가 이 문제 세트 동안 일시 중지됩니다.
          다른 세트 문제로 이동하면 감독이 자동 재활성화됩니다.
        </div>
      </div>
    );
  }
  return (
    <div className="mb-6 border-l-2 border-[--color-border-strong] px-5 py-3">
      <div className="text-[10px] font-semibold tracking-widest text-muted-fg mb-0.5">
        {set.title}
      </div>
      {set.scenario && <div className="text-sm text-primary">{set.scenario}</div>}
    </div>
  );
}

/* ─────────── 문제 카드 ─────────── */

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="bg-white border border-[--color-border] rounded-md p-8 shadow-sm">
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-semibold text-muted-fg tracking-widest">
            문제 {question.index.toString().padStart(2, "0")}
          </span>
          <span className="text-[10px] text-muted tracking-wider uppercase">
            {questionTypeLabel(question.type)}
          </span>
        </div>
        <span className="text-sm font-tabular font-medium text-primary">
          배점 {question.maxScore}
        </span>
      </div>

      <div className="mb-8 text-base leading-relaxed text-primary whitespace-pre-line">
        {question.content}
      </div>

      {question.policy && (
        <div className="mb-6 text-xs text-[--color-warning] border border-[--color-warning] rounded-sm px-3 py-2 bg-[--color-warning-muted]">
          {question.policy}
        </div>
      )}

      <AnswerBody question={question} answer={answer} onChange={onChange} />
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
                "w-full text-left border rounded-sm p-4 flex gap-3 items-start transition",
                active
                  ? "border-primary bg-[--color-accent-muted]"
                  : "border-[--color-border] hover:border-[--color-border-strong] bg-white"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition",
                  active
                    ? "border-primary bg-primary"
                    : "border-[--color-border-strong]"
                )}
              >
                {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="text-sm text-primary flex-1">{opt.text}</div>
              <div className="text-xs font-tabular text-muted-fg uppercase">
                {opt.id}
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
      <input
        type="text"
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="답을 입력하세요"
        className="w-full border border-[--color-border-strong] rounded-sm px-4 py-3 font-tabular text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
          placeholder="여기에 서술하세요."
          rows={8}
          className="w-full border border-[--color-border-strong] rounded-sm px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
        />
        <div className="mt-2 flex justify-end text-xs text-muted-fg font-tabular">
          {text.length}자
        </div>
      </div>
    );
  }

  if (question.type === "work_based") {
    const slots = (answer as Record<string, unknown>) ?? {};
    return (
      <div className="space-y-5">
        {question.slots?.map((slot) => (
          <div key={slot.id}>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-semibold text-primary">
                {slot.label}
              </label>
              <span className="text-[10px] font-tabular text-muted-fg">
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
                className="w-full border border-[--color-border-strong] rounded-sm px-3 py-2 text-sm font-tabular focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            ) : slot.type === "file" ? (
              <div className="border border-dashed border-[--color-border-strong] rounded-sm px-4 py-6 text-center text-sm text-muted-fg hover:border-primary transition cursor-pointer">
                파일을 드래그하거나 클릭하여 업로드
                <div className="text-[10px] mt-1">
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
                className="w-full border border-[--color-border-strong] rounded-sm px-3 py-2 text-sm font-tabular focus:outline-none focus:border-primary"
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
    <div className="mt-8 flex items-center gap-3 justify-between">
      <button
        disabled={!canPrev}
        onClick={onPrev}
        className={cn(
          "px-5 h-11 rounded-sm border text-sm font-medium transition",
          canPrev
            ? "border-[--color-border-strong] bg-white text-primary hover:bg-[--color-surface-hover]"
            : "border-[--color-border] text-muted cursor-not-allowed"
        )}
      >
        ← 이전 문제
      </button>
      <div className="flex items-center gap-2">
        <button className="px-5 h-11 rounded-sm border border-[--color-border-strong] bg-white text-sm text-primary font-medium hover:bg-[--color-surface-hover]">
          저장
        </button>
        {canNext ? (
          <button
            onClick={onNext}
            className="px-5 h-11 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-[--color-primary-hover]"
          >
            다음 문제 →
          </button>
        ) : (
          <button className="px-5 h-11 rounded-sm bg-[--color-danger] text-white text-sm font-semibold hover:opacity-90">
            최종 제출
          </button>
        )}
      </div>
    </div>
  );
}

function questionTypeLabel(t: Question["type"]) {
  switch (t) {
    case "multiple_choice":
      return "객관식";
    case "short_answer":
      return "단답형";
    case "essay":
      return "서술형";
    case "work_based":
      return "작업형";
  }
}
