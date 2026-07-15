import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";
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

  // 유효한 세션 쿠키가 있고 · 이 초대의 세션이며 · 미제출이면 자동 재접속
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (cookieSessionId) {
    const { data: cookieSession } = await admin
      .from("exam_sessions")
      .select("id, invitation_id, submit_time")
      .eq("id", cookieSessionId)
      .maybeSingle();
    if (
      cookieSession &&
      cookieSession.invitation_id === invitation.id &&
      !cookieSession.submit_time
    ) {
      redirect(`/exam/session/${cookieSession.id}/take`);
    }
    if (cookieSession?.submit_time) {
      redirect(`/exam/session/${cookieSession.id}/done`);
    }
  }

  const isExpired = invitation.status === "expired";
  const maskedEmail = maskEmail(invitation.email);
  // 세션이 이미 제출된 경우만 차단 · used 상태는 재접속 허용
  const { data: existingSession } = await admin
    .from("exam_sessions")
    .select("submit_time")
    .eq("invitation_id", invitation.id)
    .maybeSingle();
  const alreadySubmitted = !!existingSession?.submit_time;
  const isReconnect = invitation.status === "used" && !alreadySubmitted;

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

        {alreadySubmitted && (
          <div className="rounded-md bg-info-soft border border-info p-5">
            <div className="font-bold text-info text-sm mb-1">
              이미 제출된 시험
            </div>
            <div className="text-xs text-muted-foreground">
              이 초대의 시험은 이미 제출되었습니다. 결과 이메일을 기다려주세요.
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
        {isReconnect && !alreadySubmitted && (
          <div className="rounded-md bg-warning-soft border border-warning p-4 text-xs">
            <span className="font-bold text-warning">🔄 재접속</span>{" "}
            <span className="text-muted-foreground">
              이전 세션이 있습니다. 이메일 · OTP를 다시 인증하면 이어서 응시할 수 있습니다.
            </span>
          </div>
        )}
        {!alreadySubmitted && !isExpired && (
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
