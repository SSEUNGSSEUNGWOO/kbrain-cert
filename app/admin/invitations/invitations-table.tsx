"use client";

import { useMemo, useState } from "react";

type Status = "created" | "sent" | "used" | "expired";
type Row = {
  id: string;
  name: string;
  email: string;
  organization: string;
  examTitle: string;
  inviteCode: string;
  status: Status;
  sentAt: string | null;
  usedAt: string | null;
};

type StatusFilter = "전체" | "미발송" | "발송됨" | "사용됨" | "만료";

const statusStyle: Record<Status, { bg: string; text: string; label: string }> = {
  created: { bg: "bg-surface-soft", text: "text-muted-foreground", label: "미발송" },
  sent: { bg: "bg-info-soft", text: "text-info", label: "발송됨" },
  used: { bg: "bg-success-soft", text: "text-success", label: "사용됨" },
  expired: { bg: "bg-danger-soft", text: "text-danger", label: "만료" },
};

const filterToStatus: Record<Exclude<StatusFilter, "전체">, Status> = {
  미발송: "created",
  발송됨: "sent",
  사용됨: "used",
  만료: "expired",
};

export function InvitationsTable({ rows }: { rows: Row[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return rows.filter((inv) => {
      if (statusFilter !== "전체" && inv.status !== filterToStatus[statusFilter])
        return false;
      if (
        search &&
        !inv.name.includes(search) &&
        !inv.email.includes(search) &&
        !inv.organization.includes(search)
      )
        return false;
      return true;
    });
  }, [rows, statusFilter, search]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 · 이메일 · 조직 검색"
            className="w-full h-10 pl-10 pr-4 rounded-md bg-surface-soft border border-border text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">
            ⌕
          </div>
        </div>
        <div className="flex gap-1">
          {(["전체", "미발송", "발송됨", "사용됨", "만료"] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 h-10 rounded-md text-xs font-bold transition ${
                  statusFilter === s
                    ? "bg-primary text-white"
                    : "bg-surface-soft text-muted-foreground hover:bg-subtle"
                }`}
              >
                {s}
              </button>
            )
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="px-5 py-2 border-b border-border bg-primary-soft flex items-center justify-between">
          <div className="text-sm font-bold text-primary">
            {selected.size}명 선택됨
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 rounded-sm bg-white border border-border hover:border-primary text-xs font-bold">
              초대코드 재발급
            </button>
            <button className="h-8 px-3 rounded-sm bg-primary hover:bg-primary-hover text-white text-xs font-bold">
              이메일 일괄 발송 (M3)
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-surface-soft">
          <tr className="text-left text-[10px] font-bold tracking-widest text-muted uppercase">
            <th className="pl-5 pr-2 py-3 w-8">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selected.size === filtered.length}
                onChange={toggleAll}
                className="w-4 h-4 rounded-sm accent-primary"
              />
            </th>
            <th className="px-3 py-3">응시자</th>
            <th className="px-3 py-3">조직</th>
            <th className="px-3 py-3">시험</th>
            <th className="px-3 py-3">초대코드</th>
            <th className="px-3 py-3">상태</th>
            <th className="px-3 py-3">발송</th>
            <th className="px-5 py-3">사용</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map((inv) => {
            const isSel = selected.has(inv.id);
            const st = statusStyle[inv.status];
            return (
              <tr
                key={inv.id}
                className={`hover:bg-surface-hover transition ${
                  isSel ? "bg-primary-soft/40" : ""
                }`}
              >
                <td className="pl-5 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(inv.id)}
                    className="w-4 h-4 rounded-sm accent-primary"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="font-bold text-sm">{inv.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {inv.email}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {inv.organization}
                </td>
                <td className="px-3 py-3 text-xs text-foreground max-w-xs truncate">
                  {inv.examTitle}
                </td>
                <td className="px-3 py-3">
                  <span className="font-tabular text-[11px] font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-sm">
                    {inv.inviteCode}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm ${st.bg} ${st.text}`}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground font-tabular whitespace-nowrap">
                  {inv.sentAt ?? "-"}
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground font-tabular whitespace-nowrap">
                  {inv.usedAt ?? "-"}
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-5 py-16 text-center text-sm text-muted-foreground"
              >
                <div className="font-bold text-foreground mb-1">
                  {rows.length === 0
                    ? "아직 초대된 응시자가 없습니다"
                    : "조건에 맞는 응시자가 없습니다"}
                </div>
                <div className="text-xs">
                  {rows.length === 0
                    ? "+ 명단 CSV 업로드로 첫 초대를 시작하세요 (M3 진입 시 실동작)"
                    : "필터를 조정해보세요"}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          {filtered.length}명 표시 · 전체 {rows.length}명
        </div>
      </div>
    </div>
  );
}
