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

const TYPE_LABEL: Record<Question["type"], string> = {
  multiple_choice: "객관식",
  short_answer: "단답형",
  essay: "서술형",
  work_based: "작업형",
};
const TYPE_TONE: Record<Question["type"], string> = {
  multiple_choice: "bg-blue-100 text-blue-800 border-blue-300",
  short_answer: "bg-emerald-100 text-emerald-800 border-emerald-300",
  essay: "bg-violet-100 text-violet-800 border-violet-300",
  work_based: "bg-amber-100 text-amber-800 border-amber-300",
};

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

  const answeredCount = answered.size;
  const totalScore = mockExam.totalScore;

  const toggleFlag = (id: string) =>
    setFlagged((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            >
              KB
            </Link>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                CBT · {mockExam.grade.replace(/\(.+\)/, "").trim()}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {mockExam.title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="text-xs text-right">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                응시자
              </div>
              <div className="font-semibold text-slate-900">
                {mockSession.applicantName}
              </div>
            </div>
            <div className="text-xs text-right">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                문항
              </div>
              <div className="font-semibold text-slate-900">
                {currentIdx + 1}/{mockQuestions.length} ·{" "}
                {TYPE_LABEL[currentQuestion.type]}
              </div>
            </div>
            <ProctorBadges proctoring={mockSession.proctoring} />
            <Timer remaining={remaining} total={mockExam.durationMinutes * 60} />
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
            style={{ width: `${(remaining / (mockExam.durationMinutes * 60)) * 100}%` }}
          />
        </div>
      </header>

      {proctoringDisabled && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500 text-white text-sm">
              ⚑
            </div>
            <div className="text-sm text-amber-900 leading-relaxed">
              <b>감독 일시 비활성 (세트 단위 정책)</b> · 이 문제 세트는 외부 도구
              사용이 허용됩니다. 얼굴·음성·전체화면 감지가 이 구간 동안 중지되며,
              다른 세트로 이동 시 자동 재활성화됩니다.
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
          answeredCount={answeredCount}
          totalScore={totalScore}
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
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← 이전 문항
            </button>
            {currentIdx < mockQuestions.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentIdx((i) => Math.min(mockQuestions.length - 1, i + 1))
                }
                className="rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
              >
                다음 문항 →
              </button>
            ) : (
              <button className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 shadow-sm">
                최종 제출
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─────────── Header parts ─────────── */

function ProctorBadges({
  proctoring,
}: {
  proctoring: typeof mockSession.proctoring;
}) {
  return (
    <div className="hidden md:flex items-center gap-2">
      <ProctorPill
        label="얼굴"
        ok={proctoring.face === "ok"}
      />
      <ProctorPill label="음성" ok={proctoring.voice === "ok"} />
      <ProctorPill label="화면" ok={proctoring.fullscreen === "ok"} />
      <ProctorPill
        label="녹화"
        ok={proctoring.recording === "recording"}
        recording
      />
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
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        recording && ok
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-amber-300 bg-amber-50 text-amber-700"
      )}
    >
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full",
          recording && ok
            ? "bg-rose-500 animate-pulse"
            : ok
            ? "bg-emerald-500"
            : "bg-amber-500"
        )}
      />
      {label}
    </span>
  );
}

function Timer({ remaining, total }: { remaining: number; total: number }) {
  const warn = remaining < 5 * 60;
  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 py-1.5 rounded-lg tabular-nums border-2 shadow-sm",
        warn
          ? "bg-rose-100 text-rose-700 border-rose-400 animate-pulse"
          : "bg-blue-50 text-blue-700 border-blue-300"
      )}
      title={`시험 총 ${Math.round(total / 60)}분 · 서버 시각 기준`}
    >
      <span className="font-mono text-2xl font-bold leading-none">
        {formatTime(remaining)}
      </span>
      <span className="text-[10px] font-semibold opacity-80 mt-0.5">
        남은 시간
      </span>
    </div>
  );
}

/* ─────────── 좌측 문항 그리드 ─────────── */

function QuestionRail({
  questions,
  currentIdx,
  answered,
  flagged,
  onSelect,
  answeredCount,
  totalScore,
}: {
  questions: Question[];
  currentIdx: number;
  answered: Set<number>;
  flagged: Set<string>;
  onSelect: (i: number) => void;
  answeredCount: number;
  totalScore: number;
}) {
  return (
    <aside className="w-60 flex-shrink-0">
      <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            문항 진행
          </span>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {answeredCount}/{questions.length}
          </span>
        </div>

        {mockSets.map((set) => {
          const qs = questions.filter((q) => q.setId === set.id);
          return (
            <div key={set.id} className="mb-4">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {set.proctoringDisabled && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
                <span className="truncate">
                  {set.title.replace(/\s*·.*$/, "")}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {qs.map((q) => {
                  const i = questions.findIndex((qq) => qq.id === q.id);
                  const isCurrent = i === currentIdx;
                  const isAnswered = answered.has(i);
                  const isFlagged = flagged.has(q.id);
                  const cls = isCurrent
                    ? "bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1"
                    : isFlagged
                    ? "bg-amber-200 text-amber-900 ring-1 ring-amber-400 hover:bg-amber-300"
                    : isAnswered
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200";
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onSelect(i)}
                      className={cn(
                        "relative aspect-square rounded-md text-xs font-semibold tabular-nums transition-colors",
                        cls
                      )}
                    >
                      {q.index}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 text-sm leading-none">
                          🚩
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-100" /> 미응답
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-100" /> 응답 완료
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-200 ring-1 ring-amber-400" />{" "}
            🚩 검토 표시
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-900" /> 현재 문항
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
          총 배점{" "}
          <span className="font-bold text-slate-900 tabular-nums">{totalScore}</span>
          점 · 100점 환산 표시
        </div>
      </div>
    </aside>
  );
}

/* ─────────── 문제 카드 ─────────── */

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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/40 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center h-8 min-w-[3rem] px-2.5 rounded-md bg-slate-900 text-white text-sm font-bold tabular-nums">
          Q{question.index}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
            TYPE_TONE[question.type]
          )}
        >
          {TYPE_LABEL[question.type]}
        </span>
        <button
          onClick={onToggleFlag}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition-colors",
            flagged
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          🚩 {flagged ? "검토 표시됨" : "검토 표시"}
        </button>
        <span className="text-[11px] text-slate-500">
          배점{" "}
          <span className="font-semibold text-slate-900">{question.maxScore}점</span>
        </span>
      </div>

      <div className="px-8 pt-6 pb-4">
        {question.type === "work_based" && (
          <div className="mb-5 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500 text-white text-lg">
                ✓
              </div>
              <div className="flex-1 space-y-1.5 text-sm text-emerald-950">
                <div className="font-bold text-emerald-900">
                  작업형 섹션 — 자유 작업 환경
                </div>
                <div className="space-y-0.5 text-[13px] leading-relaxed">
                  <div>
                    • <b>외부 도구 사용 허용</b> (LLM · IDE · CLI 등)
                  </div>
                  <div>
                    • <b>전체화면 이탈 자유</b> — 이 구간은 감독 일시 비활성입니다
                  </div>
                  <div>• 서버 기준 마감 시각은 계속 흐릅니다</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-line">
          {question.content}
        </div>
      </div>

      <div className="px-8 pt-2 pb-8">
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
      <div className="space-y-2.5 select-none">
        {question.options?.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange({ selected: opt.id })}
              className={cn(
                "group w-full text-left px-5 py-4 rounded-xl border-2 transition-all",
                active
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
              )}
            >
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full font-mono text-xs font-bold",
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700"
                  )}
                >
                  {opt.id.toUpperCase()}
                </span>
                <span
                  className={cn(
                    "flex-1 leading-relaxed text-[15px]",
                    active ? "text-blue-950 font-medium" : "text-slate-700"
                  )}
                >
                  {opt.text}
                </span>
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
        className="w-full min-h-[140px] rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-[15px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
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
          className="w-full min-h-[220px] rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-[15px] focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 resize-y"
          placeholder="여기에 서술하세요 (200~300자 권장)"
        />
        <div className="mt-2 flex justify-end text-xs text-slate-500 tabular-nums">
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
            <label className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {slot.label}{" "}
                <span className="text-rose-500 text-[10px] font-bold">* 필수</span>
              </span>
              <span className="text-[10px] font-tabular text-slate-500">
                배점 {slot.maxScore}
              </span>
            </label>
            {slot.type === "long_text" ? (
              <textarea
                value={(slots[slot.id] as string) ?? ""}
                onChange={(e) =>
                  onChange({ ...slots, [slot.id]: e.target.value })
                }
                className="w-full min-h-[120px] rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-[15px] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 resize-none"
                placeholder="여기에 작성하세요"
              />
            ) : slot.type === "file" ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/50 p-8 text-center cursor-pointer transition">
                <div className="text-3xl mb-2">📎</div>
                <div className="text-sm font-semibold text-slate-700">
                  파일을 드래그하거나 클릭하여 업로드
                </div>
                <div className="text-xs text-slate-500 mt-1">
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
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-[15px] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
}
