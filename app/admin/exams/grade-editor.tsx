"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type GradeOption = { id: string; name: string };

export function GradeEditor({
  examId,
  gradeId,
  grades,
}: {
  examId: string;
  gradeId: string | null;
  grades: GradeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = grades.find((g) => g.id === gradeId);
  const label = current?.name ?? "미지정";

  async function change(nextId: string | null) {
    if (nextId === gradeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeId: nextId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
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

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition"
        title="등급 변경"
      >
        {label}
        <span className="text-[8px] opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 rounded-md border border-border bg-white shadow-lg py-1 min-w-[100px]">
          {grades.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => void change(g.id)}
              disabled={busy}
              className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-surface-soft ${
                gradeId === g.id ? "text-primary" : "text-foreground"
              } flex items-center gap-2`}
            >
              {g.name}
              {gradeId === g.id && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </button>
          ))}
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
