import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { sendOtpEmail } from "@/lib/email/send-invitation";

const OTP_TTL_MINUTES = 10;

/**
 * 응시자 진입 페이지에서 OTP 요청
 * Body: { code (invite_code), email }
 * - 초대 유효성 · 이메일 매칭 확인
 * - 6자리 OTP 생성 · guest_otp_codes insert
 * - 이메일 발송 (stub · 콘솔 출력)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { code, email } = (body ?? {}) as { code?: string; email?: string };
  if (!code || !email) {
    return NextResponse.json(
      { error: "code and email required" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: invitation, error: findErr } = await admin
    .from("exam_invitations")
    .select("id, email, status, exam_id")
    .eq("invite_code", code)
    .single();
  if (findErr || !invitation) {
    return NextResponse.json({ error: "invitation not found" }, { status: 404 });
  }
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "email mismatch" }, { status: 403 });
  }
  if (invitation.status === "used" || invitation.status === "expired") {
    return NextResponse.json(
      { error: `invitation ${invitation.status}` },
      { status: 400 }
    );
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const { error: insertErr } = await admin.from("guest_otp_codes").insert({
    invitation_id: invitation.id,
    email: invitation.email,
    code: otp,
    expires_at: expiresAt.toISOString(),
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await sendOtpEmail({
    to: invitation.email,
    code: otp,
    expiresInMinutes: OTP_TTL_MINUTES,
  });

  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: OTP_TTL_MINUTES,
  });
}
