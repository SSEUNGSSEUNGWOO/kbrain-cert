"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = [
  { value: "admin", label: "관리자" },
  { value: "examiner", label: "감독관" },
  { value: "grader", label: "채점자" },
] as const;

export function CreateAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setDone(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, name, position, organization }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setDone(true);
      setEmail("");
      setPassword("");
      setName("");
      setPosition("");
      setOrganization("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none";
  const labelCls =
    "text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold transition"
      >
        + 계정 추가
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="rounded-md bg-white border border-border w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold">스태프 계정 추가</h3>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>이메일 *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="staff@kbrainc.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>비밀번호 * (6자 이상)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>역할 *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className={inputCls}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>직책</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="본부장"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>소속</label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="kbrainc"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
              {error}
            </div>
          )}
          {done && (
            <div className="rounded-md bg-success-soft border border-success text-xs p-3 font-bold text-success">
              ✓ 계정 생성 완료 — 바로 로그인할 수 있습니다.
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 h-10 rounded-md bg-white border border-border text-sm font-bold hover:border-primary transition"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-10 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition"
            >
              {busy ? "생성 중…" : "계정 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
