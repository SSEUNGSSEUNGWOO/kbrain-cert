"use client";

import { useMemo, useState } from "react";
import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { mockQuestionBank, type QuestionBankItem } from "@/lib/mock";

const CATEGORIES = ["전체", "생성형AI 활용", "데이터 분석", "서비스 구현"];
const GRADES: Array<QuestionBankItem["grade"] | "전체"> = [
  "전체",
  "Green",
  "Blue",
  "Black",
  "전문인재",
];

const gradeStyle: Record<QuestionBankItem["grade"], string> = {
  Green: "bg-success-soft text-success",
  Blue: "bg-info-soft text-info",
  Black: "bg-primary-soft text-primary",
  전문인재: "bg-warning-soft text-warning",
};

const difficultyStyle: Record<QuestionBankItem["difficulty"], string> = {
  쉬움: "bg-success-soft text-success",
  보통: "bg-info-soft text-info",
  어려움: "bg-danger-soft text-danger",
};

export default function QuestionsPage() {
  const [category, setCategory] = useState<string>("전체");
  const [grade, setGrade] = useState<string>("전체");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return mockQuestionBank.filter((q) => {
      if (category !== "전체" && q.category !== category) return false;
      if (grade !== "전체" && q.grade !== grade) return false;
      if (
        search &&
        !q.content.includes(search) &&
        !q.code.includes(search) &&
        !q.tags.some((t) => t.includes(search))
      )
        return false;
      return true;
    });
  }, [category, grade, search]);

  const stats = {
    total: mockQuestionBank.length,
    inUse: mockQuestionBank.filter((q) => q.usedInExams > 0).length,
    unused: mockQuestionBank.filter((q) => q.usedInExams === 0).length,
    recent: 2,
  };

  return (
    <AdminShell active="questions">
      <PageHeader
        title="문제은행"
        description={`전체 ${stats.total}개 · 작업형(슬롯형) 문항 · 슬롯 구성 편집기로 관리`}
        action={
          <>
            <SecondaryButton>JSON 대량 업로드</SecondaryButton>
            <PrimaryButton>+ 새 문제 등록</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="전체 문제" value={stats.total} unit="개" />
        <StatBox label="사용 중" value={stats.inUse} unit="개" tone="success" />
        <StatBox label="미사용" value={stats.unused} unit="개" tone="warning" />
        <StatBox label="최근 7일" value={stats.recent} unit="개" tone="info" />
      </div>

      <div className="rounded-md bg-white border border-border overflow-hidden">
        {/* 필터 툴바 */}
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="문제 코드 · 내용 · 태그 검색"
                className="w-full h-10 pl-10 pr-4 rounded-md bg-surface-soft border border-border text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">
                ⌕
              </div>
            </div>
            <SecondaryButton size="sm">고급 필터</SecondaryButton>
          </div>
          <div className="flex items-center gap-4">
            <FilterGroup label="카테고리" options={CATEGORIES} value={category} onChange={setCategory} />
            <FilterGroup label="등급" options={GRADES} value={grade} onChange={setGrade} />
          </div>
        </div>

        {/* 리스트 */}
        <table className="w-full text-sm">
          <thead className="bg-surface-soft">
            <tr className="text-left text-[10px] font-bold tracking-widest text-muted uppercase">
              <th className="px-5 py-3">코드</th>
              <th className="px-3 py-3">문제 내용</th>
              <th className="px-3 py-3">카테고리</th>
              <th className="px-3 py-3">등급</th>
              <th className="px-3 py-3">난이도</th>
              <th className="px-3 py-3 text-right">슬롯</th>
              <th className="px-3 py-3 text-right">배점</th>
              <th className="px-3 py-3 text-right">사용</th>
              <th className="px-5 py-3">최종 수정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((q) => (
              <tr
                key={q.id}
                className="hover:bg-surface-hover cursor-pointer transition"
              >
                <td className="px-5 py-3">
                  <div className="font-tabular text-xs font-bold text-primary">
                    {q.code}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-foreground line-clamp-1 max-w-md">
                    {q.content}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {q.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-bold text-muted-foreground bg-surface-soft px-1.5 py-0.5 rounded-sm"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {q.category}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm ${gradeStyle[q.grade]}`}
                  >
                    {q.grade}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm ${difficultyStyle[q.difficulty]}`}
                  >
                    {q.difficulty}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-tabular text-xs font-bold">
                  {q.slots}
                </td>
                <td className="px-3 py-3 text-right font-tabular text-xs font-bold">
                  {q.maxScore}
                </td>
                <td className="px-3 py-3 text-right">
                  {q.usedInExams > 0 ? (
                    <span className="font-tabular text-xs font-bold text-primary">
                      {q.usedInExams}회
                    </span>
                  ) : (
                    <span className="text-xs text-muted">미사용</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  <div className="font-tabular">{q.updatedAt}</div>
                  <div className="text-[10px] text-muted">{q.createdBy}</div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  조건에 맞는 문제가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            {filtered.length}개 표시 · 전체 {mockQuestionBank.length}개
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-sm hover:bg-surface-hover font-tabular">‹</button>
            <button className="w-8 h-8 rounded-sm bg-primary text-white font-tabular">1</button>
            <button className="w-8 h-8 rounded-sm hover:bg-surface-hover font-tabular">2</button>
            <button className="w-8 h-8 rounded-sm hover:bg-surface-hover font-tabular">3</button>
            <button className="w-8 h-8 rounded-sm hover:bg-surface-hover font-tabular">›</button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] font-bold tracking-widest text-muted uppercase">
        {label}
      </div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-2.5 h-7 rounded-sm text-[11px] font-bold transition ${
              value === o
                ? "bg-primary text-white"
                : "bg-surface-soft text-muted-foreground hover:bg-subtle"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
