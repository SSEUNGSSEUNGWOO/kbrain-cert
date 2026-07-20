"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ExamOption = { id: string; title: string };

export function CreateInvitationForm({ exams }: { exams: ExamOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    inviteCode: string;
    entryUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, email, name, phone, organization }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setResult({ inviteCode: data.inviteCode, entryUrl: data.entryUrl });
      setEmail("");
      setName("");
      setPhone("");
      setOrganization("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold transition"
      >
        + 초대 만들기
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="rounded-md bg-white border border-border w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold">응시자 초대 만들기</h3>
          <button
            onClick={() => {
              setOpen(false);
              setResult(null);
              setError(null);
            }}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
              시험
            </label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
              이메일 (선택)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="applicant@example.com"
              className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
                이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="홍길동"
                className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
                전화번호 *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="010-1234-5678"
                className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
                소속
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="회사명"
                className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
              />
          </div>

          {error && (
            <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
              {error}
            </div>
          )}
          {result && (
            <div className="rounded-md bg-success-soft border border-success text-xs p-3 space-y-1">
              <div className="font-bold text-success">
                ✓ 초대 생성 완료
              </div>
              <div>
                <span className="text-muted-foreground">코드:</span>{" "}
                <code className="font-tabular">{result.inviteCode}</code>
              </div>
              <div className="break-all">
                <span className="text-muted-foreground">진입 URL:</span>{" "}
                <a
                  href={result.entryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {result.entryUrl}
                </a>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setResult(null);
                setError(null);
              }}
              className="flex-1 h-10 rounded-md bg-white border border-border text-sm font-bold hover:border-primary transition"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-10 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition"
            >
              {busy ? "생성 중…" : "초대 만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
