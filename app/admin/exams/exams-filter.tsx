"use client";

import { useState } from "react";
import Link from "next/link";
import { ScheduleEditor } from "./schedule-editor";
import { SlugEditor } from "./slug-editor";
import { TestModeToggle } from "./test-mode-toggle";
import { ScreenShareToggle } from "./screen-share-toggle";
import { TitleEditor } from "./title-editor";

type StatusFilter = "all" | "open" | "draft" | "closed";

type ExamRow = {
  id: string;
  title: string;
  status: "open" | "draft" | "closed";
  grade: string;
  examDate: string | null;
  durationMinutes: number;
  maxParticipants: number | null;
  setCount: number;
  questionCount: number;
  passScore: number;
  slug: string | null;
  isTestMode: boolean;
  allowNoScreenShare: boolean;
};

const statusStyle = {
  open: { text: "text-danger", bg: "bg-danger-soft", label: "OPEN", pulse: true },
  draft: { text: "text-info", bg: "bg-info-soft", label: "DRAFT", pulse: false },
  closed: {
    text: "text-muted-foreground",
    bg: "bg-surface-soft",
    label: "CLOSED",
    pulse: false,
  },
} as const;

export function ExamsFilter({ rows }: { rows: ExamRow[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const filtered =
    statusFilter === "all"
      ? rows
      : rows.filter((r) => r.status === statusFilter);

  return (
    <>
      <div className="flex items-center gap-1 mb-4">
        <StatusButton
          label="전체"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatusButton
          label="Open"
          active={statusFilter === "open"}
          onClick={() => setStatusFilter("open")}
        />
        <StatusButton
          label="Draft"
          active={statusFilter === "draft"}
          onClick={() => setStatusFilter("draft")}
        />
        <StatusButton
          label="Closed"
          active={statusFilter === "closed"}
          onClick={() => setStatusFilter("closed")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.map((e) => (
          <ExamAdminCard key={e.id} exam={e} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            해당 상태의 시험이 없습니다.
          </div>
        )}
      </div>
    </>
  );
}

function StatusButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded-sm text-xs font-bold transition ${
        active
          ? "bg-primary text-white"
          : "bg-surface-soft text-muted-foreground hover:bg-subtle"
      }`}
    >
      {label}
    </button>
  );
}

function ExamAdminCard({ exam }: { exam: ExamRow }) {
  const status = statusStyle[exam.status];
  const examDate = exam.examDate
    ? new Date(exam.examDate).toISOString().slice(0, 10).replace(/-/g, ".")
    : "미정";
  return (
    <div className="rounded-md bg-white border border-border p-6 hover:border-primary transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm ${status.bg} ${status.text}`}
            >
              {status.pulse && (
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              )}
              {status.label}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {exam.grade}
            </span>
            {exam.isTestMode && (
              <span className="text-[10px] font-bold text-warning bg-warning-soft px-2 py-0.5 rounded-sm">
                TEST
              </span>
            )}
          </div>
          <TitleEditor examId={exam.id} title={exam.title} />
          <div className="text-xs text-muted-foreground font-tabular">
            {examDate} · {exam.durationMinutes}분
          </div>
        </div>
        <ScheduleEditor
          examId={exam.id}
          examDate={exam.examDate}
          durationMinutes={exam.durationMinutes}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-border mb-4">
        <StatMini
          label="응시 정원"
          value={exam.maxParticipants ? `${exam.maxParticipants}명` : "무제한"}
          sub="capacity"
        />
        <StatMini
          label="문제 세트"
          value={`${exam.setCount}세트`}
          sub={`${exam.questionCount}문항`}
        />
        <StatMini label="시간" value={`${exam.durationMinutes}분`} sub="총합" />
      </div>

      <SlugEditor examId={exam.id} slug={exam.slug} />
      <TestModeToggle examId={exam.id} isTestMode={exam.isTestMode} />
      <ScreenShareToggle
        examId={exam.id}
        allowNoScreenShare={exam.allowNoScreenShare}
      />

      <div className="flex items-center gap-2 mt-3">
        <Link
          href={`/admin/exams/${exam.id}/preview`}
          className="flex-1 h-9 rounded-md bg-white border border-border hover:border-primary text-xs font-bold flex items-center justify-center transition"
        >
          첨부 미리보기
        </Link>
        <Link
          href={`/admin/invitations?examId=${exam.id}`}
          className="flex-1 h-9 rounded-md bg-white border border-border hover:border-primary text-xs font-bold flex items-center justify-center transition"
        >
          응시자 관리
        </Link>
        <Link
          href={`/admin/exams/${exam.id}/results`}
          className="flex-1 h-9 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center transition"
        >
          결과 · 통계
        </Link>
      </div>
    </div>
  );
}

function StatMini({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1">
        {label}
      </div>
      <div className="font-tabular font-bold text-lg text-foreground">
        {value}
      </div>
      <div className="text-[10px] text-muted font-tabular">{sub}</div>
    </div>
  );
}
