"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AttachmentViewer, type Attachment } from "@/components/attachment-viewer";
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

export function PracticeRunner({
  slug,
  exam,
  sets,
  questions,
}: {
  slug: string;
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
  };
  sets: Set[];
  questions: Question[];
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});

  const currentQ = questions[currentIdx];
  const currentSet = sets.find((s) => s.id === currentQ?.set_id);
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

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar exam={exam} slug={slug} />

      <div className="flex-1 mx-auto max-w-7xl w-full px-6 py-6 flex gap-6">
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
            />
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
            <button
              onClick={() =>
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={currentIdx === questions.length - 1}
              className="h-11 px-5 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              다음 문항 →
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ────── Top bar ────── */

function TopBar({
  exam,
  slug,
}: {
  exam: {
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
  };
  slug: string;
}) {
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
          <div className="text-[10px] font-bold tracking-widest text-info uppercase mb-0.5">
            Practice · 테스트 링크
          </div>
          <div className="font-bold text-sm truncate">{exam.title}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {exam.grade && (
            <span className="hidden md:inline-flex text-[10px] font-bold text-primary bg-primary-soft px-2 py-1 rounded-sm">
              {exam.grade}
            </span>
          )}
          <span className="hidden md:inline-flex text-[10px] font-bold text-muted-foreground bg-surface-soft px-2 py-1 rounded-sm">
            {exam.durationMinutes}분
          </span>
          <span className="hidden md:inline-flex text-[10px] font-bold text-success bg-success-soft px-2 py-1 rounded-sm">
            합격 {exam.passScore}/100
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-info bg-info-soft px-2.5 py-1 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-info" />
            답안 저장 X
          </span>
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
    <details className="rounded-md bg-white border border-border overflow-hidden group" open>
      <summary className="px-6 py-4 border-b border-border bg-surface-soft flex items-center gap-3 cursor-pointer list-none">
        <span className="font-tabular text-lg font-bold text-primary tabular-nums">
          {String(setIndex + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
            Set {setIndex + 1} · {set.title}
          </div>
          <div className="text-xs text-muted-foreground">
            현재 문항 {questionIndexInSet + 1} / {totalInSet} · 첨부 {set.attachments.length}개
          </div>
        </div>
        <span className="text-xs text-muted-foreground group-open:hidden">▾ 열기</span>
        <span className="text-xs text-muted-foreground hidden group-open:inline">▴ 접기</span>
      </summary>
      {set.scenario && (
        <div className="px-6 py-4 border-b border-border bg-warning-soft/30">
          <div className="text-[10px] font-bold tracking-widest text-warning uppercase mb-1">
            시나리오
          </div>
          <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {set.scenario}
          </div>
        </div>
      )}
      {set.attachments.length > 0 && (
        <div className="p-4">
          <AttachmentViewer
            attachments={set.attachments}
            practiceSlug={slug}
          />
        </div>
      )}
    </details>
  );
}

/* ────── 문항 카드 ────── */

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      <div className="px-8 py-4 border-b border-border bg-surface-soft flex items-center gap-3">
        <div className="font-tabular text-xs font-bold text-primary bg-primary-soft px-2 py-1 rounded-sm">
          {question.code}
        </div>
        <div className="text-xs font-bold text-muted-foreground">
          배점 {question.max_score}점
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="text-[15px] leading-relaxed whitespace-pre-line text-foreground mb-6">
          {question.content}
        </div>
        <SlotEditor
          slots={question.submission_slots}
          values={answer}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function SlotEditor({
  slots,
  values,
  onChange,
}: {
  slots: Slot[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const setValue = (id: string, v: unknown) => {
    onChange({ ...values, [id]: v });
  };

  return (
    <div className="space-y-5">
      <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
        답안 (테스트 · 저장되지 않음)
      </div>
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
              <div className="rounded-md border-2 border-dashed border-border-strong bg-surface-soft py-6 text-center text-xs text-muted-foreground">
                파일 업로드 (테스트 링크에서는 저장되지 않음)
                {slot.accept && (
                  <div className="text-[10px] mt-1">허용: {slot.accept}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
