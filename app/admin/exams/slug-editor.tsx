"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SlugEditor({
  examId,
  slug,
}: {
  examId: string;
  slug: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug ?? "");
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
        body: JSON.stringify({ slug: value.trim() || null }),
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
      <div className="mt-2 flex items-center gap-2 text-xs font-tabular">
        <span className="text-muted-foreground">응시 링크:</span>
        <a
          href={`/exam/${slug ?? examId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate text-primary font-semibold hover:underline"
        >
          /exam/{slug ?? examId} ↗
        </a>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto shrink-0 text-[10px] font-bold text-muted-foreground hover:text-primary"
        >
          편집
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-2 rounded-md border border-border p-3">
      <label
        htmlFor={`exam-slug-${examId}`}
        className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
      >
        응시 링크 slug
      </label>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-tabular">/exam/</span>
        <input
          id={`exam-slug-${examId}`}
          value={value}
          onChange={(event) => setValue(event.target.value.toLowerCase())}
          placeholder="2026-policy-exam"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          className="min-w-0 flex-1 h-8 rounded-sm border border-border px-2 text-xs font-tabular focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(slug ?? "");
            setError(null);
          }}
          className="h-8 px-3 rounded-sm border border-border text-[10px] font-bold"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-8 px-3 rounded-sm bg-primary text-white text-[10px] font-bold disabled:opacity-50"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        영문 소문자, 숫자, 하이픈만 사용할 수 있습니다. 비우면 시험 ID 링크를 사용합니다.
      </p>
      {error && <p className="mt-1 text-[10px] font-bold text-danger">{error}</p>}
    </form>
  );
}

function readableError(error: string | undefined): string {
  if (error === "slug already exists") return "이미 사용 중인 slug입니다.";
  if (error === "invalid slug") return "slug 형식을 확인해주세요.";
  return error ?? "저장 실패";
}
