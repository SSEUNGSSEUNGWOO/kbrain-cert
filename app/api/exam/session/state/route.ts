import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 응시자용 세션 상태 조회 · 시간 연장 · 강제 종료 실시간 반영
 */
export async function GET() {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, status, submit_time, time_extension_minutes")
    .eq("id", cookieSessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  return NextResponse.json({
    timeExtensionMinutes: session.time_extension_minutes ?? 0,
    isSubmitted: !!session.submit_time || session.status === "submitted",
  });
}
