import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/send-invitation";

/**
 * 관리자용 초대 생성
 * Body: { examId, email, name?, organization?, sendEmail?: boolean }
 * - 12자 hex invite_code 생성 · exam_invitations insert
 * - sendEmail=true면 초대 이메일 발송 (지금은 콘솔 stub · Resend 등록 후 실 발송)
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // admin role 확인
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const {
    examId,
    email,
    name,
    organization,
    sendEmail = true,
  } = (body ?? {}) as {
    examId?: string;
    email?: string;
    name?: string;
    organization?: string;
    sendEmail?: boolean;
  };
  if (!examId || !email) {
    return NextResponse.json(
      { error: "examId and email required" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, title, exam_date")
    .eq("id", examId)
    .single();
  if (examErr || !exam) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }

  const inviteCode = randomBytes(6).toString("hex"); // 12자 hex
  const { data: inv, error: insertErr } = await admin
    .from("exam_invitations")
    .insert({
      exam_id: examId,
      email,
      name: name ?? null,
      organization: organization ?? null,
      invite_code: inviteCode,
      status: sendEmail ? "sent" : "created",
      sent_at: sendEmail ? new Date().toISOString() : null,
    })
    .select("id, invite_code")
    .single();
  if (insertErr || !inv) {
    return NextResponse.json(
      { error: insertErr?.message ?? "insert failed" },
      { status: 500 }
    );
  }

  const entryUrl = buildEntryUrl(request, inv.invite_code);

  if (sendEmail) {
    await sendInvitationEmail({
      to: email,
      name: name ?? null,
      examTitle: exam.title,
      entryUrl,
      scheduledAt: exam.exam_date ? new Date(exam.exam_date) : null,
    });
  }

  return NextResponse.json({
    ok: true,
    id: inv.id,
    inviteCode: inv.invite_code,
    entryUrl,
  });
}

function buildEntryUrl(request: Request, code: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/exam/${code}`;
}
