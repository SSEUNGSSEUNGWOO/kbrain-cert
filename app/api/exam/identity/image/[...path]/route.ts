import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 신분증 이미지 조회
 * 인증 2방식:
 * 1) admin/examiner 로그인 (사후 검토)
 * 2) 응시자 세션 쿠키 · path의 sessionId와 일치 (자기 것 재확인)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = path.join("/");
  const pathSessionId = path[0];
  if (!pathSessionId) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  let authorized = false;
  const user = await getUser();
  if (user) {
    const supabase = createAdminSupabase();
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "examiner"])
      .maybeSingle();
    if (role) authorized = true;
  }
  if (!authorized) {
    const cookieStore = await cookies();
    const cookieSessionId = verifySessionCookieValue(
      cookieStore.get(SESSION_COOKIE_NAME)?.value
    );
    if (cookieSessionId && cookieSessionId === pathSessionId) {
      authorized = true;
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from("identity-documents")
    .download(storagePath);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "not found" },
      { status: 404 }
    );
  }
  const arrayBuffer = await data.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
