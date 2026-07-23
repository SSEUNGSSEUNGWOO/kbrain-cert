"use client";

import { useState } from "react";
import { renderInvitationEmail } from "@/lib/email/invitation-template";

export function EmailTemplateButton({
  examTitle,
  examDate,
  durationMinutes,
  slug,
  examId,
}: {
  examTitle: string;
  examDate: string | null;
  durationMinutes: number;
  slug: string | null;
  examId: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contact, setContact] = useState("databus@nia.or.kr / 010-0000-0000");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const entryUrl = `${origin}/exam/${slug ?? examId}`;
  const period = examDate
    ? new Date(examDate).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "개별 시작 · 상시 개방";

  const html = renderInvitationEmail({
    examTitle,
    examPeriod: period,
    durationMinutes,
    entryUrl,
    contact,
  });

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: 선택 후 안내
      const textarea = document.createElement("textarea");
      textarea.value = html;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-9 px-3 rounded-md bg-white border border-border hover:border-primary text-xs font-bold flex items-center justify-center gap-1 transition"
      >
        ✉ 이메일 템플릿
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl max-h-[90vh] rounded-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
                  Email Template
                </div>
                <div className="font-bold text-base mt-0.5">
                  응시 안내 이메일 미리보기
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground text-xl"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 border-b border-border shrink-0 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                  문의처 (담당자 및 연락처)
                </label>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                  응시 진입 URL (자동)
                </label>
                <div className="h-9 rounded-md border border-border bg-surface-soft px-3 text-xs text-muted-foreground font-tabular flex items-center truncate">
                  {entryUrl}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-surface-soft p-6">
              <iframe
                title="이메일 미리보기"
                srcDoc={html}
                className="w-full min-h-[720px] bg-white rounded-md border border-border"
                sandbox=""
              />
            </div>

            <div className="border-t border-border px-6 py-3 shrink-0 flex items-center justify-between gap-4">
              <div className="text-[11px] text-muted-foreground">
                {`"{평가 대상}" 자리는 응시자 이름으로 개별 치환하여 발송하세요.`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-4 rounded-md border border-border text-xs font-bold hover:border-primary transition"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={copyHtml}
                  className={`h-9 px-4 rounded-md text-xs font-bold transition ${
                    copied
                      ? "bg-success text-white"
                      : "bg-primary hover:bg-primary-hover text-white"
                  }`}
                >
                  {copied ? "✓ 복사됨" : "HTML 복사"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
