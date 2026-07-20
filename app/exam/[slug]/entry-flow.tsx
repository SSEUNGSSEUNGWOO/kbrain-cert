"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EntryFlow({ examId }: { examId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          name: name.trim(),
          phoneLast4: phoneLast4.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(readableError(data.error));
      router.push(`/exam/session/${data.sessionId}/take`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "진입 실패");
      setBusy(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 && /^\d{4}$/.test(phoneLast4) && !busy;

  return (
    <form
      onSubmit={submit}
      className="rounded-md bg-white border border-border p-6 space-y-4"
    >
      <div>
        <label
          htmlFor="applicant-name"
          className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block"
        >
          이름
        </label>
        <input
          id="applicant-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          placeholder="홍길동"
          className="w-full h-11 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="applicant-phone-last4"
          className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block"
        >
          전화번호 뒷 4자리
        </label>
        <input
          id="applicant-phone-last4"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          value={phoneLast4}
          onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
          required
          placeholder="0000"
          className="w-full h-14 rounded-md border-2 border-border bg-white px-3 text-2xl font-tabular tabular-nums text-center tracking-widest font-bold focus:border-primary focus:outline-none"
        />
        <div className="text-[11px] text-muted-foreground mt-1">
          관리자 명단에 등록된 전화번호의 마지막 4자리를 입력해주세요.
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-12 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition"
      >
        {busy ? "확인 중…" : "응시 시작 →"}
      </button>
    </form>
  );
}

function readableError(code: string | undefined): string {
  switch (code) {
    case "exam not found":
      return "시험 정보가 없습니다.";
    case "not on roster":
      return "명단에 등록되지 않았습니다. 이름과 전화번호 뒷 4자리를 확인해주세요.";
    case "already submitted":
      return "이미 제출된 시험입니다.";
    case "invitation expired":
      return "이 초대는 만료되었습니다.";
    case "roster ambiguous":
      return "동명이인이 여러 명 등록되어 있습니다. 관리자에게 문의해주세요.";
    default:
      return code ?? "오류가 발생했습니다.";
  }
}
