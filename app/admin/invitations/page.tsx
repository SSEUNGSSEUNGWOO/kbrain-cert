import {
  AdminShell,
  PageHeader,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { InvitationsTable } from "./invitations-table";
import { CreateInvitationForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const supabase = createAdminSupabase();

  const [{ data: invitations }, { data: exams }] = await Promise.all([
    supabase
      .from("exam_invitations")
      .select(
        "id, name, email, organization, invite_code, status, sent_at, used_at, exam_id"
      )
      .order("created_at", { ascending: false }),
    supabase.from("exams").select("id, title"),
  ]);

  const examMap = Object.fromEntries((exams ?? []).map((e) => [e.id, e.title]));
  const rows = (invitations ?? []).map((inv) => ({
    id: inv.id,
    name: inv.name ?? "-",
    email: inv.email,
    organization: inv.organization ?? "-",
    examTitle: examMap[inv.exam_id] ?? "-",
    inviteCode: inv.invite_code,
    status: inv.status as "created" | "sent" | "used" | "expired",
    sentAt: inv.sent_at,
    usedAt: inv.used_at,
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
        description={`전체 ${stats.total}명 · 명단 CSV 업로드 → 초대코드 생성 → 이메일 발송 → OTP 검증 (M3 진입 시 실동작)`}
        action={
          <>
            <SecondaryButton>CSV 다운로드</SecondaryButton>
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
