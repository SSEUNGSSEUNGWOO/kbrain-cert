"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AccountRow = {
  id: string;
  email: string;
  name: string | null;
  position: string | null;
  organization: string | null;
  roles: string[];
  createdAt: string;
};

const roleLabel: Record<string, string> = {
  admin: "관리자",
  examiner: "감독관",
  grader: "채점자",
};

const roleBadge: Record<string, string> = {
  admin: "bg-info-soft text-info",
  examiner: "bg-success-soft text-success",
  grader: "bg-warning-soft text-warning",
};

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(row: AccountRow) {
    setEditingId(row.id);
    setName(row.name ?? "");
    setPosition(row.position ?? "");
    setOrganization(row.organization ?? "");
    setError(null);
  }

  async function save(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, position, organization }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full h-9 rounded-md border border-border bg-white px-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      {error && (
        <div
          role="alert"
          className="border-b border-danger bg-danger-soft px-5 py-2 text-xs font-bold text-danger"
        >
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-surface-soft">
            <tr className="text-left text-[10px] font-bold tracking-widest text-muted uppercase">
              <th className="pl-5 pr-3 py-3">이메일</th>
              <th className="px-3 py-3">이름</th>
              <th className="px-3 py-3">직책</th>
              <th className="px-3 py-3">소속</th>
              <th className="px-3 py-3">역할</th>
              <th className="px-3 py-3">생성일</th>
              <th className="px-5 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const editing = editingId === row.id;
              return (
                <tr key={row.id} className="hover:bg-surface-hover transition">
                  <td className="pl-5 pr-3 py-3 font-semibold">{row.email}</td>
                  <td className="px-3 py-3">
                    {editing ? (
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="홍길동"
                        className={inputCls}
                      />
                    ) : (
                      row.name ?? <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {editing ? (
                      <input
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="본부장"
                        className={inputCls}
                      />
                    ) : (
                      row.position ?? <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {editing ? (
                      <input
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="kbrainc"
                        className={inputCls}
                      />
                    ) : (
                      row.organization ?? <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.roles.length === 0 && (
                        <span className="text-muted text-xs">-</span>
                      )}
                      {row.roles.map((role) => (
                        <span
                          key={role}
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            roleBadge[role] ?? "bg-surface-soft text-muted-foreground"
                          }`}
                        >
                          {roleLabel[role] ?? role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-tabular text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {editing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={busy}
                          className="h-8 px-3 rounded-md bg-white border border-border text-xs font-bold hover:border-primary transition"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => save(row.id)}
                          disabled={busy}
                          className="h-8 px-3 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-50 transition"
                        >
                          {busy ? "저장 중…" : "저장"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(row)}
                        className="h-8 px-3 rounded-md bg-white border border-border text-xs font-bold hover:border-primary transition"
                      >
                        수정
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  등록된 계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
