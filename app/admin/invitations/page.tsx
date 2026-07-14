"use client";

import { useMemo, useState } from "react";
import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { mockInvitations, type InvitationItem } from "@/lib/mock";

type StatusFilter = "전체" | "미발송" | "발송됨" | "사용됨" | "만료";

const statusStyle: Record<InvitationItem["status"], string> = {
  미발송: "bg-surface-soft text-muted-foreground",
  발송됨: "bg-info-soft text-info",
  사용됨: "bg-success-soft text-success",
  만료: "bg-danger-soft text-danger",
};

export default function InvitationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return mockInvitations.filter((inv) => {
      if (statusFilter !== "전체" && inv.status !== statusFilter) return false;
      if (
        search &&
        !inv.name.includes(search) &&
        !inv.email.includes(search) &&
        !inv.organization.includes(search)
      )
        return false;
      return true;
    });
  }, [statusFilter, search]);

  const stats = {
    total: mockInvitations.length,
    sent: mockInvitations.filter((i) => i.status === "발송됨").length,
    used: mockInvitations.filter((i) => i.status === "사용됨").length,
    expired: mockInvitations.filter((i) => i.status === "만료").length,
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  return (
    <AdminShell active="invitations">
      <PageHeader
        title="응시자 초대"
        description="명단 CSV 업로드 → 초대코드 생성 → 이메일 발송 → OTP 검증 → 세션 생성"
        action={
          <>
            <SecondaryButton>CSV 다운로드</SecondaryButton>
            <PrimaryButton>+ 명단 CSV 업로드</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="전체 초대" value={stats.total} unit="명" />
        <StatBox label="발송됨" value={stats.sent} unit="명" tone="info" />
        <StatBox label="사용됨" value={stats.used} unit="명" tone="success" />
        <StatBox label="만료" value={stats.expired} unit="명" tone="danger" />
      </div>

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
            {(["전체", "미발송", "발송됨", "사용됨", "만료"] as StatusFilter[]).map((s) => (
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
            ))}
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
                이메일 일괄 발송
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
                    <div className="text-[11px] text-muted-foreground">{inv.email}</div>
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
                      className={`inline-flex text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm ${statusStyle[inv.status]}`}
                    >
                      {inv.status}
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
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  조건에 맞는 응시자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            {filtered.length}명 표시 · 전체 {mockInvitations.length}명
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-sm hover:bg-surface-hover font-tabular">‹</button>
            <button className="w-8 h-8 rounded-sm bg-primary text-white font-tabular">1</button>
            <button className="w-8 h-8 rounded-sm hover:bg-surface-hover font-tabular">›</button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
