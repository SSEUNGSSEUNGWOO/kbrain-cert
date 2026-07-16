import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 답안 파일 다운로드/미리보기
 * 인증 2방식:
 * 1) 관리자/감독관 로그인 → 통과
 * 2) 응시자 세션 쿠키 · path의 sessionId와 일치 → 통과
 *
 * ?download=<filename> → attachment · 아니면 inline
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = path.join("/");
  const { searchParams } = new URL(request.url);
  const downloadName = searchParams.get("download");

  const pathSessionId = path[0];
  if (!pathSessionId) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  let authorized = false;

  // 1) 로그인 사용자 (admin/examiner)
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

  // 2) 응시자 세션 쿠키
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
    .from("answer-files")
    .download(storagePath);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "not found" },
      { status: 404 }
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const contentType = data.type || "application/octet-stream";
  const disposition = downloadName
    ? `attachment; filename="${sanitizeAscii(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    : "inline";

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeAscii(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
}
