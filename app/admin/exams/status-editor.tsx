"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "draft" | "open" | "closed";

const STATUS_STYLE: Record<
  Status,
  { text: string; bg: string; label: string; pulse: boolean }
> = {
  open: { text: "text-danger", bg: "bg-danger-soft", label: "OPEN", pulse: true },
  draft: { text: "text-info", bg: "bg-info-soft", label: "DRAFT", pulse: false },
  closed: {
    text: "text-muted-foreground",
    bg: "bg-surface-soft",
    label: "CLOSED",
    pulse: false,
  },
};

export function StatusEditor({
  examId,
  status,
}: {
  examId: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function change(next: Status) {
    if (next === status) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "저장 실패");
      setOpen(false);
      router.refresh();
    } catch (changeError) {
      setError(
        changeError instanceof Error ? changeError.message : "저장 실패"
      );
    } finally {
      setBusy(false);
    }
  }

  const current = STATUS_STYLE[status];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm cursor-pointer ${current.bg} ${current.text} hover:ring-1 hover:ring-primary/40 transition`}
        title="상태 변경"
      >
        {current.pulse && (
          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
        )}
        {current.label}
        <span className="ml-0.5 text-[8px] opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 rounded-md border border-border bg-white shadow-lg py-1 min-w-[110px]">
          {(Object.keys(STATUS_STYLE) as Status[]).map((s) => {
            const style = STATUS_STYLE[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => void change(s)}
                disabled={busy}
                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 hover:bg-surface-soft ${
                  status === s ? "text-primary" : style.text
                }`}
              >
                {style.pulse && (
                  <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                )}
                {style.label}
                {status === s && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p className="absolute left-0 top-full mt-1 text-[10px] font-bold text-danger whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
}
