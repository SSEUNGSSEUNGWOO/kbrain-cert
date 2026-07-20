import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  makeSessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 응시자 진입 · 이름 + 전화 뒷4자리로 명단 매칭
 * Body: { examId, name, phoneLast4 }
 * - exam_invitations에서 (exam_id, name, right(digits(phone), 4)) 매칭
 * - 매칭 성공 시: exam_sessions 재사용 or 신규 생성 → HMAC 쿠키 발급
 * - 매칭 실패 시: not on roster (이름·전화 조합 미등록)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { examId, name, phoneLast4 } = (body ?? {}) as {
    examId?: string;
    name?: string;
    phoneLast4?: string;
  };
  if (!examId || !name || !phoneLast4) {
    return NextResponse.json(
      { error: "examId, name, phoneLast4 required" },
      { status: 400 }
    );
  }
  if (!/^\d{4}$/.test(phoneLast4)) {
    return NextResponse.json(
      { error: "phoneLast4 must be 4 digits" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();

  const { data: exam } = await admin
    .from("exams")
    .select("id, is_test_mode")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }

  // (exam_id, name) 후보 조회 → phone 뒷4자리 서버 필터 (RLS · 함수 인덱스 활용은 unique index에서)
  const trimmedName = name.trim();
  const { data: candidates, error: findErr } = await admin
    .from("exam_invitations")
    .select("id, phone, status")
    .eq("exam_id", examId)
    .eq("name", trimmedName);
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  const matches = (candidates ?? []).filter(
    (inv) => digitsLast4(inv.phone) === phoneLast4
  );

  if (matches.length === 0) {
    return NextResponse.json({ error: "not on roster" }, { status: 404 });
  }
  if (matches.length > 1) {
    // 마이그레이션의 unique index로 사전 차단되어 이론상 발생 안 함 (삼중 방어)
    return NextResponse.json({ error: "roster ambiguous" }, { status: 409 });
  }

  const invitation = matches[0];
  if (invitation.status === "expired") {
    return NextResponse.json(
      { error: "invitation expired" },
      { status: 400 }
    );
  }

  const existingQuery = admin
    .from("exam_sessions")
    .select("id, submit_time")
    .eq("invitation_id", invitation.id);
  const { data: existingSession } = await (exam.is_test_mode
    ? existingQuery
        .eq("is_test_attempt", true)
        .is("submit_time", null)
        .order("created_at", { ascending: false })
        .limit(1)
    : existingQuery.eq("is_test_attempt", false)
  ).maybeSingle();

  if (!exam.is_test_mode && existingSession?.submit_time) {
    return NextResponse.json(
      { error: "already submitted" },
      { status: 400 }
    );
  }

  let sessionId: string;
  let reconnect = !!existingSession;
  if (existingSession) {
    sessionId = existingSession.id;
  } else {
    const { data: session, error: sessionErr } = await admin
      .from("exam_sessions")
      .insert({
        exam_id: examId,
        applicant_id: null,
        invitation_id: invitation.id,
        is_test_attempt: exam.is_test_mode,
        status: "waiting",
      })
      .select("id")
      .single();
    if (sessionErr?.code === "23505") {
      const { data: concurrentSession, error: concurrentError } = await admin
        .from("exam_sessions")
        .select("id, submit_time")
        .eq("invitation_id", invitation.id)
        .eq("is_test_attempt", exam.is_test_mode)
        .is("submit_time", null)
        .single();
      if (concurrentError || !concurrentSession) {
        return NextResponse.json(
          { error: concurrentError?.message ?? "session lookup failed" },
          { status: 500 }
        );
      }
      if (concurrentSession.submit_time) {
        return NextResponse.json(
          { error: "already submitted" },
          { status: 400 }
        );
      }
      sessionId = concurrentSession.id;
      reconnect = true;
    } else if (sessionErr || !session) {
      return NextResponse.json(
        { error: sessionErr?.message ?? "session create failed" },
        { status: 500 }
      );
    } else {
      sessionId = session.id;
    }
  }

  // 초대 상태 갱신 (첫 사용 시만)
  if (invitation.status !== "used") {
    const nowIso = new Date().toISOString();
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
    reconnect,
  });
}

function digitsLast4(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}
