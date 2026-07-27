import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 응시자 제출 초기화
 * - staff (admin) 만 실행 가능
 * - confirmName 이 invitation.name 과 정확히 일치해야 실행 (실수 방지)
 * - exam_sessions 행을 삭제하면 answers · monitoring_events · examiner_actions · recording_chunks 는 FK cascade 로 자동 삭제
 * - answer-files · identity-documents 버킷의 파일은 명시적으로 재귀 삭제
 * - invitation.status 를 sent_at 유무에 따라 'sent' 또는 'created' 로 되돌리고 used_at 초기화
 * → 응시자는 처음처럼 다시 진입 가능
 */
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

  const body = (await request.json().catch(() => null)) as {
    invitationId?: string;
    confirmName?: string;
  } | null;
  const invitationId = body?.invitationId?.trim();
  const confirmName = body?.confirmName?.trim();
  if (!invitationId || !confirmName) {
    return NextResponse.json(
      { error: "invitationId, confirmName required" },
      { status: 400 }
    );
  }

  const { data: invitation, error: invErr } = await admin
    .from("exam_invitations")
    .select("id, name, sent_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
  if (!invitation) {
    return NextResponse.json({ error: "invitation not found" }, { status: 404 });
  }
  const invAny = invitation as { id: string; name: string; sent_at: string | null };
  if (invAny.name.trim() !== confirmName) {
    return NextResponse.json(
      { error: "응시자 이름이 일치하지 않습니다" },
      { status: 400 }
    );
  }

  const { data: sessions, error: sesErr } = await admin
    .from("exam_sessions")
    .select("id, identity_image_url")
    .eq("invitation_id", invitationId);
  if (sesErr) return NextResponse.json({ error: sesErr.message }, { status: 500 });

  const sessionRows = (sessions ?? []) as {
    id: string;
    identity_image_url: string | null;
  }[];

  // 1. 신분증 이미지 삭제 (identity-documents)
  const identityPaths = sessionRows
    .map((s) => s.identity_image_url)
    .filter((p): p is string => !!p);
  if (identityPaths.length > 0) {
    await admin.storage.from("identity-documents").remove(identityPaths);
  }

  // 2. 답안 첨부파일 재귀 삭제 (answer-files/{sessionId}/...)
  for (const s of sessionRows) {
    await purgeStoragePrefix(admin, "answer-files", s.id);
  }

  // 3. exam_sessions 삭제 (cascade 로 answers · monitoring_events · examiner_actions · recording_chunks 정리)
  if (sessionRows.length > 0) {
    const { error: delErr } = await admin
      .from("exam_sessions")
      .delete()
      .eq("invitation_id", invitationId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 4. invitation 상태 롤백 — 이메일 발송 이력이 있으면 'sent', 없으면 'created'
  const nextStatus = invAny.sent_at ? "sent" : "created";
  const { error: updErr } = await admin
    .from("exam_invitations")
    .update({ status: nextStatus, used_at: null })
    .eq("id", invitationId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    deletedSessions: sessionRows.length,
    nextStatus,
  });
}

async function purgeStoragePrefix(
  admin: ReturnType<typeof createAdminSupabase>,
  bucket: string,
  prefix: string
): Promise<void> {
  const toDelete: string[] = [];
  const stack: string[] = [prefix];
  while (stack.length > 0) {
    const p = stack.pop() as string;
    const { data } = await admin.storage.from(bucket).list(p, { limit: 1000 });
    for (const item of data ?? []) {
      const full = `${p}/${item.name}`;
      // Supabase Storage: 파일은 metadata 를 가지고 폴더는 갖지 않음
      if (item.metadata) toDelete.push(full);
      else stack.push(full);
    }
  }
  // remove 는 한 번에 1000개 한도 · 안전하게 100개씩 배치
  for (let i = 0; i < toDelete.length; i += 100) {
    await admin.storage.from(bucket).remove(toDelete.slice(i, i + 100));
  }
}
