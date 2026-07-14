"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { mockExamCards, type ExamCard } from "@/lib/mock";

type StatusFilter = "all" | "live" | "upcoming" | "closed";

export default function ExamsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered =
    statusFilter === "all"
      ? mockExamCards
      : mockExamCards.filter((e) => e.status === statusFilter);

  const stats = {
    total: mockExamCards.length,
    live: mockExamCards.filter((e) => e.status === "live").length,
    upcoming: mockExamCards.filter((e) => e.status === "upcoming").length,
    closed: mockExamCards.filter((e) => e.status === "closed").length,
  };

  return (
    <AdminShell active="exams">
      <PageHeader
        title="시험 관리"
        description="시험 CRUD · 세트 조합 · 응시자 초대 · 결과 관리"
        action={
          <>
            <SecondaryButton>템플릿에서 복제</SecondaryButton>
            <PrimaryButton>+ 새 시험</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="전체 시험" value={stats.total} unit="개" />
        <StatBox label="진행 중" value={stats.live} unit="개" tone="danger" />
        <StatBox label="예정" value={stats.upcoming} unit="개" tone="info" />
        <StatBox label="종료" value={stats.closed} unit="개" tone="success" />
      </div>

      <div className="flex items-center gap-1 mb-4">
        <StatusButton label="전체" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <StatusButton label="진행 중" active={statusFilter === "live"} onClick={() => setStatusFilter("live")} />
        <StatusButton label="예정" active={statusFilter === "upcoming"} onClick={() => setStatusFilter("upcoming")} />
        <StatusButton label="종료" active={statusFilter === "closed"} onClick={() => setStatusFilter("closed")} />
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
    </AdminShell>
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

const statusStyle = {
  live: { text: "text-danger", bg: "bg-danger-soft", label: "LIVE", pulse: true },
  upcoming: { text: "text-info", bg: "bg-info-soft", label: "예정", pulse: false },
  closed: { text: "text-muted-foreground", bg: "bg-surface-soft", label: "종료", pulse: false },
};

function ExamAdminCard({ exam }: { exam: ExamCard }) {
  const status = statusStyle[exam.status];
  const regPct = Math.round((exam.registered / exam.capacity) * 100);
  return (
    <div className="rounded-md bg-white border border-border p-6 hover:border-primary transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm ${status.bg} ${status.text}`}
            >
              {status.pulse && (
                <span className={`w-1.5 h-1.5 rounded-full bg-danger animate-pulse`} />
              )}
              {status.label}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {exam.category}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              · {exam.grade}
            </span>
          </div>
          <div className="font-bold text-base text-heading mb-1">
            {exam.title}
          </div>
          <div className="text-xs text-muted-foreground font-tabular">
            {exam.date} · {exam.time}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-border mb-4">
        <StatMini
          label="응시 등록"
          value={`${exam.registered}/${exam.capacity}`}
          sub={`${regPct}%`}
        />
        <StatMini
          label="문제 세트"
          value="3세트"
          sub="9문항"
        />
        <StatMini
          label={exam.status === "live" ? "평균 진행" : "채점 대기"}
          value={
            exam.status === "live" && exam.progress !== undefined
              ? `${exam.progress}%`
              : "0명"
          }
          sub={exam.status === "live" ? "실시간" : "-"}
          tone={exam.status === "live" ? "danger" : "muted"}
        />
      </div>

      <div className="mb-4">
        <div className="h-1 bg-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${regPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/examiner/monitor"
          className="flex-1 h-9 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center transition"
        >
          {exam.status === "live" ? "모니터링" : "상세 보기"}
        </Link>
        <Link
          href="/admin/invitations"
          className="flex-1 h-9 rounded-md bg-white border border-border hover:border-primary text-xs font-bold flex items-center justify-center transition"
        >
          응시자 관리
        </Link>
        <button className="h-9 px-3 rounded-md bg-white border border-border hover:border-primary text-xs font-bold transition">
          ⋯
        </button>
      </div>
    </div>
  );
}

function StatMini({
  label,
  value,
  sub,
  tone = "primary",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "primary" | "danger" | "muted";
}) {
  const textColor = {
    primary: "text-foreground",
    danger: "text-danger",
    muted: "text-muted",
  }[tone];
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1">
        {label}
      </div>
      <div className={`font-tabular font-bold text-lg ${textColor}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted font-tabular">{sub}</div>
    </div>
  );
}
