"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 시험별 예약 시각 · 시험 시간 편집 인라인 폼
 * datetime-local 값을 로컬 문자열 → ISO로 변환해 서버 저장
 */
export function ScheduleEditor({
  examId,
  examDate,
  durationMinutes,
}: {
  examId: string;
  examDate: string | null;
  durationMinutes: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateLocal, setDateLocal] = useState(toDatetimeLocal(examDate));
  const [duration, setDuration] = useState(durationMinutes);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const iso = dateLocal ? new Date(dateLocal).toISOString() : null;
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examDate: iso,
          durationMinutes: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMsg({ ok: true, text: "저장됨" });
      router.refresh();
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : "저장 실패",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-7 px-2.5 rounded-sm bg-white border border-border hover:border-primary text-[10px] font-bold text-primary transition"
      >
        {examDate ? "시각 편집" : "+ 시각 설정"}
      </button>
    );
  }

  return (
    <form
      onSubmit={save}
      className="mt-2 rounded-md border border-primary bg-primary-soft/30 p-3 space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          예약 시각
          <input
            type="datetime-local"
            value={dateLocal}
            onChange={(e) => setDateLocal(e.target.value)}
            className="mt-1 block w-full h-8 rounded-sm border border-border bg-white px-2 text-xs font-tabular font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          시험 시간 (분)
          <input
            type="number"
            min={1}
            max={600}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 block w-full h-8 rounded-sm border border-border bg-white px-2 text-xs font-tabular font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none"
          />
        </label>
      </div>
      {msg && (
        <div
          className={`text-[10px] font-bold ${
            msg.ok ? "text-success" : "text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
            setDateLocal(toDatetimeLocal(examDate));
            setDuration(durationMinutes);
          }}
          className="flex-1 h-7 rounded-sm bg-white border border-border text-[10px] font-bold hover:border-primary transition"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 h-7 rounded-sm bg-primary hover:bg-primary-hover text-white text-[10px] font-bold disabled:opacity-50 transition"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

// ISO → datetime-local input value (YYYY-MM-DDTHH:mm)
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
