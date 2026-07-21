"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "created" | "sent" | "used" | "expired";
type EnvItem = { status: string; detail: string };
type SessionInfo = {
  id: string;
  status: string;
  startTime: string | null;
  submitTime: string | null;
  autoSubmitted: boolean;
  envResult: Record<string, EnvItem> | null;
  pledgeAcceptedAt: string | null;
  waitingEnteredAt: string | null;
  userAgent: string | null;
};
type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  organization: string;
  examTitle: string;
  status: Status;
  sentAt: string | null;
  usedAt: string | null;
  allowNoWebcam: boolean;
  allowNoScreenShare: boolean;
  allowDualMonitor: boolean;
  session: SessionInfo | null;
};

type ExceptionKey =
  | "allowNoWebcam"
  | "allowNoScreenShare"
  | "allowDualMonitor";

type StatusFilter = "전체" | "미발송" | "발송됨" | "사용됨" | "만료";

const statusStyle: Record<Status, { bg: string; text: string; label: string }> = {
  created: { bg: "bg-surface-soft", text: "text-muted-foreground", label: "미발송" },
  sent: { bg: "bg-info-soft", text: "text-info", label: "발송됨" },
  used: { bg: "bg-success-soft", text: "text-success", label: "사용됨" },
  expired: { bg: "bg-danger-soft", text: "text-danger", label: "만료" },
};

const filterToStatus: Record<Exclude<StatusFilter, "전체">, Status> = {
  미발송: "created",
  발송됨: "sent",
  사용됨: "used",
  만료: "expired",
};

export function InvitationsTable({ rows }: { rows: Row[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [exceptions, setExceptions] = useState(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          allowNoWebcam: row.allowNoWebcam,
          allowNoScreenShare: row.allowNoScreenShare,
          allowDualMonitor: row.allowDualMonitor,
        },
      ])
    ) as Record<string, Record<ExceptionKey, boolean>>
  );
  const [savingException, setSavingException] = useState<string | null>(null);
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  async function toggleException(invitationId: string, key: ExceptionKey) {
    const current = exceptions[invitationId]?.[key] ?? false;
    const requestKey = `${invitationId}:${key}`;
    setSavingException(requestKey);
    setExceptionError(null);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, [key]: !current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "설정 저장 실패");
      setExceptions((previous) => ({
        ...previous,
        [invitationId]: {
          ...previous[invitationId],
          [key]: !current,
        },
      }));
    } catch (error) {
      setExceptionError(
        error instanceof Error ? error.message : "설정 저장 실패"
      );
    } finally {
      setSavingException(null);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter((inv) => {
      if (statusFilter !== "전체" && inv.status !== filterToStatus[statusFilter])
        return false;
      if (
        search &&
        !inv.name.includes(search) &&
        !(inv.email ?? "").includes(search) &&
        !inv.phone.includes(search) &&
        !inv.organization.includes(search)
      )
        return false;
      return true;
    });
  }, [rows, statusFilter, search]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 · 전화번호 · 이메일 · 조직 검색"
            className="w-full h-10 pl-10 pr-4 rounded-md bg-surface-soft border border-border text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">
            ⌕
          </div>
        </div>
        <div className="flex gap-1">
          {(["전체", "미발송", "발송됨", "사용됨", "만료"] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 h-10 rounded-md text-xs font-bold transition ${
                  statusFilter === s
                    ? "bg-primary text-white"
                    : "bg-surface-soft text-muted-foreground hover:bg-subtle"
                }`}
              >
                {s}
              </button>
            )
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="px-5 py-2 border-b border-border bg-primary-soft flex items-center justify-between">
          <div className="text-sm font-bold text-primary">
            {selected.size}명 선택됨
          </div>
        </div>
      )}

      {exceptionError && (
        <div role="alert" className="border-b border-danger bg-danger-soft px-5 py-2 text-xs font-bold text-danger">
          {exceptionError}
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="bg-surface-soft">
          <tr className="text-left text-[10px] font-bold tracking-widest text-muted uppercase">
            <th className="pl-5 pr-2 py-3 w-8">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selected.size === filtered.length}
                onChange={toggleAll}
                className="w-4 h-4 rounded-sm accent-primary"
              />
            </th>
            <th className="px-3 py-3">응시자</th>
            <th className="px-3 py-3">조직</th>
            <th className="px-3 py-3">시험</th>
            <th className="px-3 py-3">상태</th>
            <th className="px-3 py-3">준비 상태</th>
            <th className="px-3 py-3">개별 예외</th>
            <th className="px-3 py-3">발송</th>
            <th className="px-5 py-3">사용</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map((inv) => {
            const isSel = selected.has(inv.id);
            const st = statusStyle[inv.status];
            return (
              <tr
                key={inv.id}
                className={`hover:bg-surface-hover transition ${
                  isSel ? "bg-primary-soft/40" : ""
                }`}
              >
                <td className="pl-5 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(inv.id)}
                    className="w-4 h-4 rounded-sm accent-primary"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="font-bold text-sm">{inv.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {inv.phone} · {inv.email ?? "이메일 없음"}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {inv.organization}
                </td>
                <td className="px-3 py-3 text-xs text-foreground max-w-xs truncate">
                  {inv.examTitle}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm ${st.bg} ${st.text}`}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <PrecheckSummary session={inv.session} onOpen={() => setDetail(inv)} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 whitespace-nowrap">
                    <ExceptionToggle
                      label="웹캠 면제"
                      active={exceptions[inv.id]?.allowNoWebcam ?? false}
                      busy={savingException === `${inv.id}:allowNoWebcam`}
                      onClick={() => void toggleException(inv.id, "allowNoWebcam")}
                    />
                    <ExceptionToggle
                      label="화면공유 면제"
                      active={exceptions[inv.id]?.allowNoScreenShare ?? false}
                      busy={savingException === `${inv.id}:allowNoScreenShare`}
                      onClick={() => void toggleException(inv.id, "allowNoScreenShare")}
                    />
                    <ExceptionToggle
                      label="듀얼 허용"
                      active={exceptions[inv.id]?.allowDualMonitor ?? false}
                      busy={savingException === `${inv.id}:allowDualMonitor`}
                      onClick={() => void toggleException(inv.id, "allowDualMonitor")}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground font-tabular whitespace-nowrap">
                  {inv.sentAt ?? "-"}
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground font-tabular whitespace-nowrap">
                  {inv.usedAt ?? "-"}
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={9}
                className="px-5 py-16 text-center text-sm text-muted-foreground"
              >
                <div className="font-bold text-foreground mb-1">
                  {rows.length === 0
                    ? "아직 초대된 응시자가 없습니다"
                    : "조건에 맞는 응시자가 없습니다"}
                </div>
                <div className="text-xs">
                  {rows.length === 0
                    ? "+ 명단 CSV 업로드로 첫 응시자를 등록하세요"
                    : "필터를 조정해보세요"}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          {filtered.length}명 표시 · 전체 {rows.length}명
        </div>
      </div>

      {detail && (
        <PrecheckDetailModal row={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function ExceptionToggle({
  label,
  active,
  busy,
  onClick,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "h-7 rounded-sm border px-2 text-[10px] font-bold transition disabled:opacity-50",
        active
          ? "border-warning bg-warning-soft text-warning"
          : "border-border bg-white text-muted-foreground hover:border-primary"
      )}
    >
      {busy ? "저장 중" : label}
    </button>
  );
}

const ENV_LABELS: Record<string, string> = {
  monitor: "1. 듀얼 모니터",
  webcam: "2. 웹캠",
  screen: "3. 화면 공유",
  network: "4. 네트워크",
  cpu: "5. CPU",
  browser: "6. 브라우저",
};

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  ok: { color: "bg-success text-white", label: "OK" },
  warn: { color: "bg-warning text-white", label: "WARN" },
  error: { color: "bg-danger text-white", label: "ERROR" },
  pending: { color: "bg-subtle text-muted", label: "..." },
};

function PrecheckSummary({
  session,
  onOpen,
}: {
  session: SessionInfo | null;
  onOpen: () => void;
}) {
  if (!session) {
    return (
      <span className="text-[10px] text-muted-foreground">미접속</span>
    );
  }
  const envOk =
    session.envResult &&
    Object.values(session.envResult).every(
      (r) => r.status === "ok" || r.status === "warn"
    );
  const pledgeOk = !!session.pledgeAcceptedAt;
  const waitingOk = !!session.waitingEnteredAt;
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 h-7 px-2 rounded-sm bg-white border border-border hover:border-primary transition"
    >
      <Dot label="환경" ok={!!envOk} />
      <Dot label="서약" ok={pledgeOk} />
      <Dot label="대기" ok={waitingOk} />
    </button>
  );
}

function Dot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          ok ? "bg-success" : "bg-subtle border border-muted"
        )}
      />
      <span className={ok ? "text-foreground" : "text-muted"}>{label}</span>
    </span>
  );
}

function PrecheckDetailModal({
  row,
  onClose,
}: {
  row: Row;
  onClose: () => void;
}) {
  const s = row.session;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-md bg-white border border-border w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
              응시자 준비 상태
            </div>
            <h3 className="font-bold text-base">
              {row.name} · {row.phone}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!s && (
            <div className="rounded-md bg-surface-soft p-8 text-center text-sm text-muted-foreground">
              아직 응시자가 진입하지 않았습니다.
            </div>
          )}

          {s && (
            <>
              {/* 스텝 타임라인 */}
              <div className="rounded-md border border-border overflow-hidden">
                <TimelineRow
                  n={1}
                  label="환경 체크 완료"
                  time={
                    s.envResult ? Object.keys(s.envResult).length > 0 : false
                  }
                  timeLabel={s.envResult ? "저장됨" : "-"}
                  ok={!!s.envResult}
                />
                <TimelineRow
                  n={2}
                  label="보안 서약 동의"
                  time={!!s.pledgeAcceptedAt}
                  timeLabel={fmtTime(s.pledgeAcceptedAt)}
                  ok={!!s.pledgeAcceptedAt}
                />
                <TimelineRow
                  n={3}
                  label="대기실 진입"
                  time={!!s.waitingEnteredAt}
                  timeLabel={fmtTime(s.waitingEnteredAt)}
                  ok={!!s.waitingEnteredAt}
                />
                <TimelineRow
                  n={4}
                  label="시험 시작"
                  time={!!s.startTime}
                  timeLabel={fmtTime(s.startTime)}
                  ok={!!s.startTime}
                />
                <TimelineRow
                  n={5}
                  label={
                    s.autoSubmitted ? "시험 제출 (시간 만료 자동)" : "시험 제출"
                  }
                  time={!!s.submitTime}
                  timeLabel={fmtTime(s.submitTime)}
                  ok={!!s.submitTime}
                />
              </div>

              {/* 환경 체크 6개 항목 */}
              {s.envResult && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
                    환경 체크 6개 항목 스냅샷
                  </div>
                  <div className="rounded-md border border-border overflow-hidden">
                    {Object.entries(ENV_LABELS).map(([key, label]) => {
                      const item = s.envResult?.[key];
                      const style =
                        STATUS_STYLE[item?.status ?? "pending"] ??
                        STATUS_STYLE.pending;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
                        >
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-sm text-[10px] font-bold w-14 text-center",
                              style.color
                            )}
                          >
                            {style.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold">{label}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item?.detail ?? "-"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 브라우저 UA */}
              {s.userAgent && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
                    브라우저 UA
                  </div>
                  <div className="rounded-md bg-surface-soft p-3 text-[11px] font-tabular text-muted-foreground break-all">
                    {s.userAgent}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  n,
  label,
  time,
  timeLabel,
  ok,
}: {
  n: number;
  label: string;
  time: boolean;
  timeLabel: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
          ok ? "bg-success text-white" : "bg-subtle text-muted"
        )}
      >
        {ok ? "✓" : n}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-bold",
            ok ? "text-foreground" : "text-muted"
          )}
        >
          {label}
        </div>
      </div>
      <div className="text-xs font-tabular text-muted-foreground whitespace-nowrap">
        {time ? timeLabel : "-"}
      </div>
    </div>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}
