"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "otp";

export function EntryFlow({
  code,
  maskedEmail,
  invitedName,
}: {
  code: string;
  maskedEmail: string;
  invitedName: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (!otpExpiresAt) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((otpExpiresAt - Date.now()) / 1000)
      );
      setRemainingSec(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [otpExpiresAt]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(readableError(data.error));
      }
      setOtpExpiresAt(new Date(data.expiresAt).getTime());
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(readableError(data.error));
      }
      router.push(`/exam/session/${data.sessionId}/take`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 실패");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md bg-white border border-border p-6 space-y-5">
      {invitedName && (
        <div className="text-sm">
          <span className="text-muted-foreground">응시자:</span>{" "}
          <span className="font-bold">{invitedName}님</span>
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        등록된 이메일 <span className="font-tabular font-bold">{maskedEmail}</span>{" "}
        을(를) 입력해주세요.
      </div>

      {step === "email" && (
        <form onSubmit={requestOtp} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
              이메일 확인
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full h-11 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          {error && (
            <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition"
          >
            {busy ? "OTP 발송 중…" : "OTP 인증 코드 받기"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp} className="space-y-3">
          <div className="rounded-md bg-info-soft border border-info text-xs p-3">
            <span className="font-bold text-info">✓ OTP 발송됨.</span>{" "}
            이메일함에서 6자리 코드를 확인해주세요.
            <span className="ml-1 font-tabular text-muted-foreground">
              (Resend 미등록 · 서버 콘솔에 출력)
            </span>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
              6자리 인증 코드
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              required
              placeholder="000000"
              className="w-full h-14 rounded-md border-2 border-border bg-white px-3 text-2xl font-tabular tabular-nums text-center tracking-widest font-bold focus:border-primary focus:outline-none"
            />
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>남은 시간</span>
              <span className="font-tabular font-bold">
                {formatMmSs(remainingSec)}
              </span>
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
              className="flex-1 h-11 rounded-md bg-white border border-border text-sm font-bold hover:border-primary transition"
            >
              이메일 다시 입력
            </button>
            <button
              type="submit"
              disabled={busy || otp.length !== 6 || remainingSec === 0}
              className="flex-1 h-11 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition"
            >
              {busy ? "인증 중…" : "인증 후 시험 진입"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function formatMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function readableError(code: string | undefined): string {
  switch (code) {
    case "invitation not found":
      return "초대 코드가 유효하지 않습니다.";
    case "email mismatch":
      return "등록된 이메일과 일치하지 않습니다.";
    case "otp not requested":
      return "OTP가 발급되지 않았습니다. 다시 요청해주세요.";
    case "otp expired":
      return "OTP가 만료되었습니다. 다시 요청해주세요.";
    case "otp mismatch":
      return "인증 코드가 일치하지 않습니다.";
    case "invitation used":
      return "이미 사용된 초대입니다.";
    case "invitation expired":
      return "만료된 초대입니다.";
    default:
      return code ?? "오류가 발생했습니다.";
  }
}
