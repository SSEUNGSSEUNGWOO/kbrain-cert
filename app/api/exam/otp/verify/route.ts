import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  makeSessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * OTP 검증 → exam_session 생성 → 세션 쿠키 발급
 * Body: { code (invite_code), email, otp }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { code, email, otp } = (body ?? {}) as {
    code?: string;
    email?: string;
    otp?: string;
  };
  if (!code || !email || !otp) {
    return NextResponse.json(
      { error: "code, email, otp required" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: invitation, error: findErr } = await admin
    .from("exam_invitations")
    .select("id, exam_id, email, status")
    .eq("invite_code", code)
    .single();
  if (findErr || !invitation) {
    return NextResponse.json({ error: "invitation not found" }, { status: 404 });
  }
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "email mismatch" }, { status: 403 });
  }

  // 가장 최근 발급된 미소진 OTP 확인
  const { data: otpRow, error: otpErr } = await admin
    .from("guest_otp_codes")
    .select("id, code, expires_at, verified_at")
    .eq("invitation_id", invitation.id)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (otpErr || !otpRow) {
    return NextResponse.json({ error: "otp not requested" }, { status: 400 });
  }
  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "otp expired" }, { status: 400 });
  }
  if (otpRow.code !== otp) {
    return NextResponse.json({ error: "otp mismatch" }, { status: 400 });
  }

  // OTP verified · 기존 세션 있으면 재사용 · 없으면 신규 생성
  const nowIso = new Date().toISOString();
  await admin
    .from("guest_otp_codes")
    .update({ verified_at: nowIso })
    .eq("id", otpRow.id);

  const { data: existingSession } = await admin
    .from("exam_sessions")
    .select("id, submit_time")
    .eq("invitation_id", invitation.id)
    .maybeSingle();

  if (existingSession?.submit_time) {
    return NextResponse.json(
      { error: "already submitted" },
      { status: 400 }
    );
  }

  let sessionId: string;
  if (existingSession) {
    sessionId = existingSession.id;
  } else {
    const { data: session, error: sessionErr } = await admin
      .from("exam_sessions")
      .insert({
        exam_id: invitation.exam_id,
        applicant_id: null,
        invitation_id: invitation.id,
        status: "waiting",
      })
      .select("id")
      .single();
    if (sessionErr || !session) {
      return NextResponse.json(
        { error: sessionErr?.message ?? "session create failed" },
        { status: 500 }
      );
    }
    sessionId = session.id;
  }

  // invitation 상태 업데이트 (첫 사용 시만 used_at 설정)
  if (invitation.status !== "used") {
    await admin
      .from("exam_invitations")
      .update({ status: "used", used_at: nowIso })
      .eq("id", invitation.id);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, makeSessionCookieValue(sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    reconnect: !!existingSession,
  });
}
