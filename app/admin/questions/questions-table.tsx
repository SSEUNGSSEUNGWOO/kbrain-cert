"use client";

import { useMemo, useState } from "react";

type Row = {
  id: string;
  code: string;
  content: string;
  difficulty: string | null;
  tags: string[];
  slots: number;
  maxScore: number;
  category: string;
  grade: string;
  usedInExams: number;
  updatedAt: string;
};

const gradeStyle: Record<string, string> = {
  Green: "bg-success-soft text-success",
  Blue: "bg-info-soft text-info",
  Black: "bg-primary-soft text-primary",
  전문인재: "bg-warning-soft text-warning",
};

const difficultyStyle: Record<string, string> = {
  쉬움: "bg-success-soft text-success",
  보통: "bg-info-soft text-info",
  어려움: "bg-danger-soft text-danger",
};

export function QuestionsTable({
  rows,
  categories,
  grades,
}: {
  rows: Row[];
  categories: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string }>;
}) {
  const [category, setCategory] = useState<string>("전체");
  const [grade, setGrade] = useState<string>("전체");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((q) => {
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
  }, [rows, category, grade, search]);

  const categoryOptions = ["전체", ...categories.map((c) => c.name)];
  const gradeOptions = ["전체", ...grades.map((g) => g.name)];

  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
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
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <FilterGroup
            label="카테고리"
            options={categoryOptions}
            value={category}
            onChange={setCategory}
          />
          <FilterGroup
            label="등급"
            options={gradeOptions}
            value={grade}
            onChange={setGrade}
          />
        </div>
      </div>

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
                {q.tags.length > 0 && (
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
                )}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {q.category}
              </td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm ${
                    gradeStyle[q.grade] ?? "bg-surface-soft text-muted"
                  }`}
                >
                  {q.grade}
                </span>
              </td>
              <td className="px-3 py-3">
                {q.difficulty && (
                  <span
                    className={`inline-flex text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm ${
                      difficultyStyle[q.difficulty] ??
                      "bg-surface-soft text-muted"
                    }`}
                  >
                    {q.difficulty}
                  </span>
                )}
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
              <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap font-tabular">
                {q.updatedAt}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={9}
                className="px-5 py-12 text-center text-sm text-muted-foreground"
              >
                조건에 맞는 문제가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          {filtered.length}개 표시 · 전체 {rows.length}개
        </div>
      </div>
    </div>
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
      <div className="flex gap-1 flex-wrap">
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
