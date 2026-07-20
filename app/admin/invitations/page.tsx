import {
  AdminShell,
  PageHeader,
  StatBox,
} from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { InvitationsTable } from "./invitations-table";
import { CreateInvitationForm } from "./create-form";
import { CsvUploadButton } from "./csv-upload-form";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const supabase = createAdminSupabase();

  const [{ data: invitations }, { data: exams }] = await Promise.all([
    supabase
      .from("exam_invitations")
      .select(
        "id, name, phone, email, organization, invite_code, status, sent_at, used_at, exam_id"
      )
      .order("created_at", { ascending: false }),
    supabase.from("exams").select("id, title"),
  ]);

  const invitationIds = (invitations ?? []).map((i) => i.id);
  const { data: sessions } = invitationIds.length
    ? await supabase
        .from("exam_sessions")
        .select(
          "invitation_id, id, status, start_time, submit_time, auto_submitted, precheck_env_result, precheck_pledge_accepted_at, precheck_waiting_entered_at, precheck_user_agent"
        )
        .in("invitation_id", invitationIds)
    : { data: [] };

  const sessionByInv: Record<string, {
    id: string;
    status: string;
    startTime: string | null;
    submitTime: string | null;
    autoSubmitted: boolean;
    envResult: Record<string, { status: string; detail: string }> | null;
    pledgeAcceptedAt: string | null;
    waitingEnteredAt: string | null;
    userAgent: string | null;
  }> = {};
  for (const s of sessions ?? []) {
    const anyS = s as {
      invitation_id: string;
      id: string;
      status: string;
      start_time: string | null;
      submit_time: string | null;
      auto_submitted: boolean;
      precheck_env_result: Record<string, { status: string; detail: string }> | null;
      precheck_pledge_accepted_at: string | null;
      precheck_waiting_entered_at: string | null;
      precheck_user_agent: string | null;
    };
    sessionByInv[anyS.invitation_id] = {
      id: anyS.id,
      status: anyS.status,
      startTime: anyS.start_time,
      submitTime: anyS.submit_time,
      autoSubmitted: anyS.auto_submitted,
      envResult: anyS.precheck_env_result,
      pledgeAcceptedAt: anyS.precheck_pledge_accepted_at,
      waitingEnteredAt: anyS.precheck_waiting_entered_at,
      userAgent: anyS.precheck_user_agent,
    };
  }

  const examMap = Object.fromEntries((exams ?? []).map((e) => [e.id, e.title]));
  const rows = (invitations ?? []).map((inv) => ({
    id: inv.id,
    name: inv.name ?? "-",
    email: inv.email,
    phone: inv.phone ?? "-",
    organization: inv.organization ?? "-",
    examTitle: examMap[inv.exam_id] ?? "-",
    inviteCode: inv.invite_code,
    status: inv.status as "created" | "sent" | "used" | "expired",
    sentAt: inv.sent_at,
    usedAt: inv.used_at,
    session: sessionByInv[inv.id] ?? null,
  }));

  const stats = {
    total: rows.length,
    sent: rows.filter((r) => r.status === "sent").length,
    used: rows.filter((r) => r.status === "used").length,
    expired: rows.filter((r) => r.status === "expired").length,
  };

  return (
    <AdminShell active="invitations">
      <PageHeader
        title="응시자 초대"
        description={`전체 ${stats.total}명 · 시험 공용 링크에서 이름과 전화번호 뒷 4자리로 진입`}
        action={
          <>
            <CsvUploadButton exams={exams ?? []} />
            <CreateInvitationForm exams={exams ?? []} />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="전체 초대" value={stats.total} unit="명" />
        <StatBox label="발송됨" value={stats.sent} unit="명" tone="info" />
        <StatBox label="사용됨" value={stats.used} unit="명" tone="success" />
        <StatBox label="만료" value={stats.expired} unit="명" tone="danger" />
      </div>

      <InvitationsTable rows={rows} />
    </AdminShell>
  );
}
