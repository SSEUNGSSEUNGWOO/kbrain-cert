import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import { EntryFlow } from "./entry-flow";

export const dynamic = "force-dynamic";

/**
 * 응시자 진입 페이지 · 인증 없이 접근 (초대 코드 URL)
 * 1. 초대 유효성 확인
 * 2. 이메일 마스킹 표시 + 이메일 입력
 * 3. OTP 요청 → OTP 입력 → 검증 → 시험 세션 진입
 */
export default async function ExamEntryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const admin = createAdminSupabase();
  const { data: invitation } = await admin
    .from("exam_invitations")
    .select("id, email, name, status, exam_id, used_at")
    .eq("invite_code", code)
    .maybeSingle();
  if (!invitation) return notFound();

  const { data: exam } = await admin
    .from("exams")
    .select("id, title, duration_minutes, exam_date")
    .eq("id", invitation.exam_id)
    .single();
  if (!exam) return notFound();

  const isExpired = invitation.status === "expired";
  const isUsed = invitation.status === "used";
  const maskedEmail = maskEmail(invitation.email);

  return (
    <div className="min-h-screen bg-surface-soft flex flex-col">
      <nav className="border-b border-border bg-white">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
              k
            </div>
            <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
          </Link>
        </div>
      </nav>

      <main className="flex-1 mx-auto max-w-lg w-full px-6 py-10 space-y-5">
        <div className="rounded-md bg-white border border-border p-6">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
            응시자 진입
          </div>
          <h1 className="text-xl font-bold mb-1">{exam.title}</h1>
          <div className="text-xs text-muted-foreground">
            시험 시간 {exam.duration_minutes}분
            {exam.exam_date &&
              ` · 일시 ${new Date(exam.exam_date).toLocaleString("ko-KR")}`}
          </div>
        </div>

        {isUsed && (
          <div className="rounded-md bg-warning-soft border border-warning p-5">
            <div className="font-bold text-warning text-sm mb-1">
              이미 사용된 초대 코드
            </div>
            <div className="text-xs text-muted-foreground">
              이 초대는{" "}
              {invitation.used_at
                ? new Date(invitation.used_at).toLocaleString("ko-KR")
                : "이미"}{" "}
              사용되었습니다. 관리자에게 문의해주세요.
            </div>
          </div>
        )}
        {isExpired && (
          <div className="rounded-md bg-danger-soft border border-danger p-5">
            <div className="font-bold text-danger text-sm mb-1">
              만료된 초대 코드
            </div>
            <div className="text-xs text-muted-foreground">
              이 초대의 유효 기간이 지났습니다. 새 초대를 요청해주세요.
            </div>
          </div>
        )}
        {!isUsed && !isExpired && (
          <EntryFlow
            code={code}
            maskedEmail={maskedEmail}
            invitedName={invitation.name}
          />
        )}

        <div className="text-[11px] text-muted-foreground text-center leading-relaxed">
          문의: <span className="font-tabular">no-reply@kbrainc.com</span>
        </div>
      </main>
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
}
