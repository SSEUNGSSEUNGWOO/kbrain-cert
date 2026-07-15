"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseInvitationCsv,
  type InvitationCsvRow,
  CSV_TEMPLATE,
} from "@/lib/csv-parse";
import { cn } from "@/lib/utils";

type ExamOption = { id: string; title: string };

export function CsvUploadButton({ exams }: { exams: ExamOption[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-md bg-white border border-border hover:border-primary text-xs font-bold transition"
      >
        + CSV 업로드
      </button>
    );
  }
  return <CsvUploadModal exams={exams} onClose={() => setOpen(false)} />;
}

function CsvUploadModal({
  exams,
  onClose,
}: {
  exams: ExamOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [parsed, setParsed] = useState<InvitationCsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    errors: Array<{ email: string; reason: string }>;
  } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows, errors } = parseInvitationCsv(text);
      setParsed(rows);
      setParseErrors(errors);
      setResult(null);
    };
    reader.readAsText(file, "utf-8");
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kbrain-cert-invitations-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (parsed.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invitations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, rows: parsed, sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setResult({
        created: (data.created ?? []).length,
        errors: data.errors ?? [],
      });
      router.refresh();
    } catch (err) {
      setResult({
        created: 0,
        errors: [
          {
            email: "-",
            reason: err instanceof Error ? err.message : "업로드 실패",
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="rounded-md bg-white border border-border w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
              대량 초대
            </div>
            <h3 className="font-bold">CSV 명단 업로드</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
              시험 선택
            </label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md bg-surface-soft p-4 space-y-2">
            <div className="text-sm font-bold">CSV 형식</div>
            <pre className="text-[11px] font-tabular text-muted-foreground bg-white p-3 rounded-sm border border-border overflow-x-auto">
{`email,name,organization
applicant1@example.com,홍길동,케이브레인
applicant2@example.com,김철수,DAEASY`}
            </pre>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              • 헤더 필수 · email 컬럼은 반드시 있어야 함 · name/organization은 선택
              <br />
              • UTF-8 인코딩 · 최대 1000행
            </div>
            <button
              onClick={downloadTemplate}
              className="h-8 px-3 rounded-sm bg-white border border-border hover:border-primary text-[11px] font-bold transition"
            >
              ↓ 템플릿 다운로드
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
              CSV 파일 선택
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="w-full text-sm file:mr-3 file:h-9 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-white file:text-xs file:font-bold file:cursor-pointer hover:file:bg-primary-hover"
            />
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-md bg-warning-soft border border-warning text-xs p-3">
              <div className="font-bold text-warning mb-1">
                {parseErrors.length}개 행 스킵됨
              </div>
              <ul className="list-disc ml-4 space-y-0.5 text-muted-foreground">
                {parseErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 5 && (
                  <li className="text-muted">
                    …외 {parseErrors.length - 5}개
                  </li>
                )}
              </ul>
            </div>
          )}

          {parsed.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                미리보기 · 총 {parsed.length}명
              </div>
              <div className="rounded-md border border-border overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-soft sticky top-0">
                    <tr className="text-left text-[10px] font-bold text-muted uppercase tracking-widest">
                      <th className="px-3 py-2">이메일</th>
                      <th className="px-3 py-2">이름</th>
                      <th className="px-3 py-2">소속</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-tabular">{r.email}</td>
                        <td className="px-3 py-2">{r.name ?? "-"}</td>
                        <td className="px-3 py-2">{r.organization ?? "-"}</td>
                      </tr>
                    ))}
                    {parsed.length > 100 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-center text-muted"
                        >
                          …외 {parsed.length - 100}행
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsed.length > 0 && !result && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">
                초대 이메일 발송
                <span className="text-xs text-muted-foreground ml-1">
                  (Resend 미등록 · 콘솔에 링크 출력)
                </span>
              </span>
            </label>
          )}

          {result && (
            <div
              className={cn(
                "rounded-md border p-4 text-sm",
                result.errors.length === 0
                  ? "bg-success-soft border-success"
                  : "bg-warning-soft border-warning"
              )}
            >
              <div className="font-bold mb-2">
                ✓ {result.created}명 초대 생성됨
                {result.errors.length > 0 && ` · ${result.errors.length}개 실패`}
              </div>
              {result.errors.length > 0 && (
                <ul className="list-disc ml-5 text-xs text-muted-foreground space-y-0.5">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      {e.email}: {e.reason}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>…외 {result.errors.length - 10}개</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 h-11 rounded-md bg-white border border-border text-sm font-bold hover:border-primary disabled:opacity-50 transition"
            >
              {result ? "닫기" : "취소"}
            </button>
            {!result && (
              <button
                onClick={upload}
                disabled={busy || parsed.length === 0}
                className="flex-1 h-11 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition"
              >
                {busy
                  ? "업로드 중…"
                  : parsed.length > 0
                  ? `${parsed.length}명 초대 생성`
                  : "CSV 파일 선택 필요"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
