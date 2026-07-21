"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TitleEditor({
  examId,
  title,
}: {
  examId: string;
  title: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readableError(data.error));
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="mb-1 flex items-start gap-2">
        <div className="flex-1 font-bold text-base text-heading">{title}</div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-sm border border-primary bg-primary-soft text-primary text-[11px] font-bold hover:bg-primary hover:text-white transition"
        >
          <span aria-hidden>✏️</span>제목 편집
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mb-1 rounded-md border border-border p-3">
      <label
        htmlFor={`exam-title-${examId}`}
        className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
      >
        시험 제목
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={`exam-title-${examId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={200}
          className="min-w-0 flex-1 h-8 rounded-sm border border-border px-2 text-xs focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(title);
            setError(null);
          }}
          className="h-8 px-3 rounded-sm border border-border text-[10px] font-bold"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="h-8 px-3 rounded-sm bg-primary text-white text-[10px] font-bold disabled:opacity-50"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] font-bold text-danger">{error}</p>}
    </form>
  );
}

function readableError(error: string | undefined): string {
  if (error === "title must be 1..200 chars") return "제목은 1~200자여야 합니다.";
  return error ?? "저장 실패";
}
