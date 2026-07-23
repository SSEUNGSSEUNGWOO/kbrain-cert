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
      className="relative bg-[#FAFAF5] border border-[#0A0A0A]/10 shadow-[0_1px_0_rgba(11,31,58,0.03),0_30px_60px_-30px_rgba(11,31,58,0.2)]"
    >
      {/* Corner marks · 시험지 모서리 감각 */}
      <span
        aria-hidden
        className="absolute -top-px -left-px w-3 h-3 border-t border-l border-[#0B1F3A]"
      />
      <span
        aria-hidden
        className="absolute -top-px -right-px w-3 h-3 border-t border-r border-[#0B1F3A]"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -left-px w-3 h-3 border-b border-l border-[#0B1F3A]"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -right-px w-3 h-3 border-b border-r border-[#0B1F3A]"
      />

      {/* Card header */}
      <div className="border-b border-[#111]/12 px-8 py-5">
        <div className="font-mono text-[9px] font-bold tracking-[0.4em] uppercase text-[#111]/50">
          Certificate · Login
        </div>
        <div className="font-bold text-base tracking-tight mt-1">
          응시자 확인
        </div>
      </div>

      <div className="px-8 py-8 space-y-8">
        {/* Name */}
        <div>
          <label
            htmlFor="applicant-name"
            className="flex items-baseline justify-between mb-3"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#111]/60">
              Name · 이름
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#111]/35">
              Required
            </span>
          </label>
          <input
            id="applicant-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="홍길동"
            className="w-full border-0 border-b border-[#111]/25 bg-transparent px-0 pb-2 h-11 text-xl font-medium placeholder:text-[#111]/20 placeholder:font-normal focus:border-[#0B1F3A] focus:outline-none focus:border-b-2 transition-colors"
          />
        </div>

        {/* Phone last 4 */}
        <div>
          <label
            htmlFor="applicant-phone-last4"
            className="flex items-baseline justify-between mb-3"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#111]/60">
              Phone · 뒷자리
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#111]/35">
              4 Digits
            </span>
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
            placeholder="0 0 0 0"
            className="w-full border-0 border-b border-[#111]/25 bg-transparent px-0 pb-2 h-16 text-4xl font-mono tabular-nums font-bold tracking-[0.55em] text-center placeholder:text-[#111]/15 placeholder:font-normal focus:border-[#0B1F3A] focus:outline-none focus:border-b-2 transition-colors"
          />
          <div className="mt-3 font-mono text-[10px] tracking-[0.18em] text-[#111]/50 uppercase flex items-center gap-2">
            <span className="w-3 h-px bg-[#111]/30" />
            본인의 전화번호 마지막 4자리
          </div>
        </div>

        {error && (
          <div className="border border-[#8B2635] bg-[#8B2635]/[0.04] px-4 py-3 text-[13px] text-[#8B2635] flex items-start gap-3">
            <span className="font-mono font-black text-lg leading-none shrink-0 mt-0.5">
              !
            </span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="group w-full bg-[#0B1F3A] hover:bg-[#0a1728] disabled:bg-[#111]/[0.08] disabled:text-[#111]/25 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-between px-8 py-5 border-t border-[#111]/12"
      >
        <div className="text-left">
          <div className="font-mono text-[9px] font-bold tracking-[0.4em] uppercase opacity-70">
            Enter
          </div>
          <div className="font-bold text-lg mt-0.5 tracking-tight">
            {busy ? "확인 중…" : "응시 시작"}
          </div>
        </div>
        <div className="font-mono text-2xl transition-transform group-hover:group-enabled:translate-x-1">
          →
        </div>
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
