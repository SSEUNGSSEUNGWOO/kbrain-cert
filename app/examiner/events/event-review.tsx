"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Exam = { id: string; title: string; exam_date: string | null };
type ReviewEvent = {
  id: number;
  session_id: string;
  event_type: string;
  severity: "info" | "warn" | "high";
  detected_at: string;
  question_index: number | null;
  is_reviewed: boolean;
  reviewer_note: string | null;
  applicantName: string;
  applicantPhone: string;
};

const EVENT_LABELS: Record<string, string> = {
  face_missing: "얼굴 미검출",
  multiple_faces: "다인원 감지",
  tab_switch: "탭 전환",
  window_blur: "창 이탈",
  copy_blocked: "복사 시도",
  context_menu_blocked: "우클릭",
  navigation_attempt: "페이지 이탈",
};

export function EventReview({ exams }: { exams: Exam[] }) {
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [eventType, setEventType] = useState("all");
  const [reviewed, setReviewed] = useState("all");
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!examId) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ examId, eventType, reviewed });
      const response = await fetch(`/api/examiner/events?${params}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "이벤트 조회 실패");
      setEvents(data.events ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "이벤트 조회 실패");
    } finally {
      setBusy(false);
    }
  }, [eventType, examId, reviewed]);

  useEffect(() => {
    // 네트워크 응답 뒤 상태를 반영하는 초기/필터 조회다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents();
  }, [loadEvents]);

  const saveReview = async (event: ReviewEvent, isReviewed: boolean, note: string) => {
    const response = await fetch("/api/examiner/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, isReviewed, reviewerNote: note }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "검토 저장 실패");
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id
          ? {
              ...item,
              is_reviewed: data.event.is_reviewed,
              reviewer_note: data.event.reviewer_note,
            }
          : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-surface-soft">
      <nav className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Examiner · Review
            </div>
            <div className="font-bold">감독 이벤트 사후 검토</div>
          </div>
          <Link href={`/examiner/monitor${examId ? `?examId=${examId}` : ""}`} className="text-xs font-bold text-primary">
            ← 실시간 감독으로
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-5 grid grid-cols-3 gap-3 rounded-md border border-border bg-white p-4">
          <Filter label="시험" value={examId} onChange={setExamId}>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </Filter>
          <Filter label="이벤트 유형" value={eventType} onChange={setEventType}>
            <option value="all">전체 유형</option>
            {Object.entries(EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Filter>
          <Filter label="검토 상태" value={reviewed} onChange={setReviewed}>
            <option value="all">전체</option>
            <option value="false">미검토</option>
            <option value="true">검토 완료</option>
          </Filter>
        </div>

        {error && <div className="mb-4 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">{error}</div>}
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <div className="grid grid-cols-[50px_150px_140px_100px_150px_1fr] gap-3 border-b border-border bg-surface-soft px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>검토</span><span>응시자</span><span>이벤트</span><span>위험도</span><span>발생 시각</span><span>감독관 메모</span>
          </div>
          {busy && <div className="p-10 text-center text-sm text-muted-foreground">불러오는 중…</div>}
          {!busy && events.map((event) => (
            <EventRow key={event.id} event={event} onSave={saveReview} />
          ))}
          {!busy && events.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">조건에 맞는 이벤트가 없습니다.</div>}
        </div>
      </main>
    </div>
  );
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm">{children}</select></label>;
}

function EventRow({ event, onSave }: { event: ReviewEvent; onSave: (event: ReviewEvent, reviewed: boolean, note: string) => Promise<void> }) {
  const [note, setNote] = useState(event.reviewer_note ?? "");
  const [saving, setSaving] = useState(false);
  const save = async (nextReviewed = event.is_reviewed) => {
    setSaving(true);
    try { await onSave(event, nextReviewed, note); } finally { setSaving(false); }
  };
  return (
    <div className={cn("grid grid-cols-[50px_150px_140px_100px_150px_1fr] items-center gap-3 border-b border-border px-4 py-3 last:border-0", event.is_reviewed && "bg-success-soft/30")}>
      <input type="checkbox" checked={event.is_reviewed} disabled={saving} onChange={(change) => void save(change.target.checked)} aria-label={`${event.applicantName} 이벤트 검토 완료`} className="h-4 w-4 accent-primary" />
      <div><Link href={`/examiner/session/${event.session_id}`} className="text-sm font-bold hover:text-primary">{event.applicantName}</Link><div className="text-[10px] text-muted-foreground">{event.applicantPhone}</div></div>
      <div className="text-xs font-bold">{EVENT_LABELS[event.event_type] ?? event.event_type}{event.question_index != null && <div className="text-[10px] text-muted-foreground">Q{event.question_index}</div>}</div>
      <span className={cn("w-fit rounded-sm px-2 py-1 text-[10px] font-bold uppercase", event.severity === "high" ? "bg-danger-soft text-danger" : event.severity === "warn" ? "bg-warning-soft text-warning" : "bg-info-soft text-info")}>{event.severity}</span>
      <span className="text-[11px] text-muted-foreground">{new Date(event.detected_at).toLocaleString("ko-KR")}</span>
      <div className="flex gap-2"><input value={note} maxLength={1000} onChange={(change) => setNote(change.target.value)} onBlur={() => { if (note !== (event.reviewer_note ?? "")) void save(); }} placeholder="검토 메모 입력" className="h-9 flex-1 rounded-md border border-border px-3 text-xs" /><button disabled={saving || note === (event.reviewer_note ?? "")} onClick={() => void save()} className="h-9 rounded-md bg-primary px-3 text-[10px] font-bold text-white disabled:opacity-30">{saving ? "저장 중" : "저장"}</button></div>
    </div>
  );
}
