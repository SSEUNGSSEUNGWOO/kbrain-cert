import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/send-invitation";

/**
 * 관리자 CSV 대량 초대
 * Body: { examId, rows: [{email, name?, organization?}], sendEmail: boolean }
 * Response: { created: [{email, inviteCode, entryUrl}], errors: [{email, reason}] }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
  const { examId, rows, sendEmail = false } = (body ?? {}) as {
    examId?: string;
    rows?: Array<{ email: string; name?: string; organization?: string }>;
    sendEmail?: boolean;
  };
  if (!examId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "examId and rows required" },
      { status: 400 }
    );
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: "max 1000 rows" }, { status: 400 });
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

  // 이미 존재하는 이메일 조회 (중복 방지)
  const emails = rows.map((r) => r.email);
  const { data: existing } = await admin
    .from("exam_invitations")
    .select("email")
    .eq("exam_id", examId)
    .in("email", emails);
  const existingSet = new Set(
    (existing ?? []).map((e) => e.email.toLowerCase())
  );

  const created: Array<{
    email: string;
    inviteCode: string;
    entryUrl: string;
  }> = [];
  const errors: Array<{ email: string; reason: string }> = [];
  const inserts: Array<{
    exam_id: string;
    email: string;
    name: string | null;
    organization: string | null;
    invite_code: string;
    status: "sent" | "created";
    sent_at: string | null;
  }> = [];
  const now = new Date().toISOString();

  for (const r of rows) {
    if (existingSet.has(r.email.toLowerCase())) {
      errors.push({ email: r.email, reason: "이미 초대된 이메일" });
      continue;
    }
    inserts.push({
      exam_id: examId,
      email: r.email,
      name: r.name ?? null,
      organization: r.organization ?? null,
      invite_code: randomBytes(6).toString("hex"),
      status: sendEmail ? "sent" : "created",
      sent_at: sendEmail ? now : null,
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json({ created, errors });
  }

  const { data: insertedRows, error: insertErr } = await admin
    .from("exam_invitations")
    .insert(inserts)
    .select("email, invite_code");
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const base = buildBase(request);
  for (const row of insertedRows ?? []) {
    const entryUrl = `${base}/exam/${row.invite_code}`;
    created.push({
      email: row.email,
      inviteCode: row.invite_code,
      entryUrl,
    });
    if (sendEmail) {
      const original = inserts.find((i) => i.invite_code === row.invite_code);
      await sendInvitationEmail({
        to: row.email,
        name: original?.name ?? null,
        examTitle: exam.title,
        entryUrl,
        scheduledAt: exam.exam_date ? new Date(exam.exam_date) : null,
      });
    }
  }

  return NextResponse.json({ created, errors });
}

function buildBase(request: Request): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin ??
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}
