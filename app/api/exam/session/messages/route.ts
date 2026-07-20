import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 응시자 → 감독관 메시지 전송 (POST) + 조회 (GET)
 * 세션 쿠키 검증 필수
 */

async function requireSession(): Promise<{ sessionId: string } | NextResponse> {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return { sessionId: cookieSessionId };
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const { content } = (body ?? {}) as { content?: string };
  const trimmed = (content ?? "").trim();
  if (!trimmed || trimmed.length > 500) {
    return NextResponse.json(
      { error: "content required (1..500)" },
      { status: 400 }
    );
  }
  const admin = createAdminSupabase();
  const { data: message, error } = await admin
    .from("session_messages")
    .insert({
      session_id: auth.sessionId,
      sender_role: "applicant",
      content: trimmed,
    })
    .select("id, sender_role, content, is_announcement, created_at, read_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ message });
}

export async function GET(_request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminSupabase();
  const { data: messages } = await admin
    .from("session_messages")
    .select("id, sender_role, content, is_announcement, created_at, read_at")
    .eq("session_id", auth.sessionId)
    .order("created_at", { ascending: true });
  return NextResponse.json({ messages: messages ?? [] });
}
