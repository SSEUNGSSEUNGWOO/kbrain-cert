"use client";

import { useMemo, useState } from "react";
import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { mockGradingQueue, type GradingItem } from "@/lib/mock";
import { cn } from "@/lib/utils";

type StatusFilter = "전체" | "대기" | "채점중" | "완료";

const statusStyle: Record<GradingItem["status"], string> = {
  대기: "bg-warning-soft text-warning",
  채점중: "bg-info-soft text-info",
  완료: "bg-success-soft text-success",
};

export default function GradingPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");

  const filtered = useMemo(() => {
    if (statusFilter === "전체") return mockGradingQueue;
    return mockGradingQueue.filter((g) => g.status === statusFilter);
  }, [statusFilter]);

  const stats = {
    pending: mockGradingQueue.filter((g) => g.status === "대기").length,
    inProgress: mockGradingQueue.filter((g) => g.status === "채점중").length,
    completed: mockGradingQueue.filter((g) => g.status === "완료").length,
    passRate: (() => {
      const completed = mockGradingQueue.filter((g) => g.status === "완료");
      if (completed.length === 0) return 0;
      const passed = completed.filter(
        (g) => (g.percentageScore ?? 0) >= g.passingScore
      ).length;
      return Math.round((passed / completed.length) * 100);
    })(),
  };

  return (
    <AdminShell active="grading">
      <PageHeader
        title="채점"
        description="작업형 전용 · 슬롯별 부분점수 수동 채점 · 100점 환산 통일 · 답안 export"
        action={
          <>
            <SecondaryButton>답안 CSV/JSON Export</SecondaryButton>
            <PrimaryButton>대기 응답 채점 시작</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="대기" value={stats.pending} unit="명" tone="warning" />
        <StatBox label="채점 중" value={stats.inProgress} unit="명" tone="info" />
        <StatBox label="완료" value={stats.completed} unit="명" tone="success" />
        <StatBox
          label="합격률"
          value={`${stats.passRate}%`}
          tone={stats.passRate >= 50 ? "success" : "danger"}
        />
      </div>

      <div className="flex items-center gap-1 mb-4">
        {(["전체", "대기", "채점중", "완료"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 h-8 rounded-sm text-xs font-bold transition",
              statusFilter === s
                ? "bg-primary text-white"
                : "bg-surface-soft text-muted-foreground hover:bg-subtle"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-md bg-white border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft">
            <tr className="text-left text-[10px] font-bold tracking-widest text-muted uppercase">
              <th className="px-5 py-3">응시자</th>
              <th className="px-3 py-3">시험</th>
              <th className="px-3 py-3">제출 시각</th>
              <th className="px-3 py-3 text-right">원점수</th>
              <th className="px-3 py-3 text-right">환산 100점</th>
              <th className="px-3 py-3 text-center">판정</th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3">채점자</th>
              <th className="pl-3 pr-5 py-3 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((g) => {
              const isPending = g.status === "대기";
              const isInProgress = g.status === "채점중";
              const passed =
                g.percentageScore !== null && g.percentageScore >= g.passingScore;
              return (
                <tr
                  key={g.id}
                  className="hover:bg-surface-hover transition cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div className="font-bold text-sm">{g.applicantName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {g.applicantOrg}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground max-w-xs truncate">
                    {g.examTitle}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground font-tabular whitespace-nowrap">
                    {g.submittedAt}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {g.rawScore !== null ? (
                      <div className="font-tabular text-sm">
                        <span className="font-bold">{g.rawScore}</span>
                        <span className="text-muted text-xs"> / {g.maxScore}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {g.percentageScore !== null ? (
                      <div className="font-tabular text-sm">
                        <span
                          className={cn(
                            "font-bold text-lg",
                            passed ? "text-success" : "text-danger"
                          )}
                        >
                          {g.percentageScore}
                        </span>
                        <span className="text-muted text-xs"> / 100</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {g.percentageScore !== null ? (
                      <span
                        className={cn(
                          "inline-flex text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm",
                          passed
                            ? "bg-success-soft text-success"
                            : "bg-danger-soft text-danger"
                        )}
                      >
                        {passed ? "합격" : "불합격"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm",
                        statusStyle[g.status]
                      )}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {g.gradedBy ? (
                      <>
                        <div>{g.gradedBy}</div>
                        <div className="text-[10px] text-muted-foreground font-tabular">
                          {g.gradedAt}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="pl-3 pr-5 py-3 text-right">
                    {isPending && (
                      <button className="h-8 px-3 rounded-sm bg-primary hover:bg-primary-hover text-white text-xs font-bold">
                        채점 시작
                      </button>
                    )}
                    {isInProgress && (
                      <button className="h-8 px-3 rounded-sm bg-white border border-primary text-primary text-xs font-bold">
                        계속 채점
                      </button>
                    )}
                    {!isPending && !isInProgress && (
                      <button className="h-8 px-3 rounded-sm bg-white border border-border hover:border-primary text-xs font-bold">
                        상세 보기
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  해당 상태의 응답이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            {filtered.length}건 표시 · 전체 {mockGradingQueue.length}건
          </div>
          <div className="text-muted-foreground">
            <span className="font-bold text-foreground font-tabular">100점 환산</span> 표기 통일 · 저장은 원점수
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
