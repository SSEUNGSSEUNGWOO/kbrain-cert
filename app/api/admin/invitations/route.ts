import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { examId, name, phone, email, organization } = (body ?? {}) as {
    examId?: string;
    name?: string;
    phone?: string;
    email?: string;
    organization?: string;
  };
  const cleanName = name?.trim();
  const cleanPhone = phone?.trim();
  if (!examId || !cleanName || !cleanPhone || !isValidPhone(cleanPhone)) {
    return NextResponse.json(
      { error: "examId, name and valid phone required" },
      { status: 400 }
    );
  }

  const { data: exam } = await admin
    .from("exams")
    .select("id, slug")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return NextResponse.json({ error: "exam not found" }, { status: 404 });

  const { data: invitation, error } = await admin
    .from("exam_invitations")
    .insert({
      exam_id: examId,
      name: cleanName,
      phone: cleanPhone,
      email: email?.trim() || null,
      organization: organization?.trim() || null,
      invite_code: randomBytes(6).toString("hex"),
      status: "created",
    })
    .select("id")
    .single();
  if (error || !invitation) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: error?.code === "23505" ? 409 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: invitation.id,
    entryUrl: buildEntryUrl(request, exam.slug ?? exam.id),
  });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    invitationId?: string;
    allowNoWebcam?: unknown;
    allowNoScreenShare?: unknown;
    allowDualMonitor?: unknown;
  } | null;
  if (!body?.invitationId) {
    return NextResponse.json({ error: "invitationId required" }, { status: 400 });
  }

  const update: {
    allow_no_webcam?: boolean;
    allow_no_screen_share?: boolean;
    allow_dual_monitor?: boolean;
  } = {};
  if (typeof body.allowNoWebcam === "boolean") {
    update.allow_no_webcam = body.allowNoWebcam;
  }
  if (typeof body.allowNoScreenShare === "boolean") {
    update.allow_no_screen_share = body.allowNoScreenShare;
  }
  if (typeof body.allowDualMonitor === "boolean") {
    update.allow_dual_monitor = body.allowDualMonitor;
  }
  if (Object.keys(update).length !== 1) {
    return NextResponse.json(
      { error: "한 번에 하나의 예외 설정만 변경할 수 있습니다" },
      { status: 400 }
    );
  }

  const { data: invitation, error } = await admin
    .from("exam_invitations")
    .update(update)
    .eq("id", body.invitationId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invitation) {
    return NextResponse.json({ error: "invitation not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 4;
}

function buildEntryUrl(request: Request, slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/exam/${slug}`;
}
