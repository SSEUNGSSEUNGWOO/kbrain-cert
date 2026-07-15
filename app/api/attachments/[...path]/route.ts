import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 첨부 파일 서버 프록시 fetch
 *
 * 인증 3방식:
 * 1) 로그인된 사용자 → 통과
 * 2) ?practice=<slug> · 유효한 practice_slug면 · 로그인 없이 통과 (테스트 링크)
 * 3) 세션 쿠키(kbrain_exam_session) 유효 · path가 그 세션의 exam에 속한 첨부면 통과 (실 응시자)
 *
 * 응답 모드:
 * - 기본: Content-Disposition: inline (브라우저 내 렌더)
 * - ?download=<filename>: Content-Disposition: attachment (파일 저장) · 한글 UTF-8 인코딩
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = path.join("/");
  const { searchParams } = new URL(request.url);
  const practiceSlug = searchParams.get("practice");
  const downloadName = searchParams.get("download");

  const supabase = createAdminSupabase();

  // 인증
  let authorized = false;
  if (practiceSlug) {
    const { data } = await supabase
      .from("exams")
      .select("id")
      .eq("practice_slug", practiceSlug)
      .maybeSingle();
    authorized = !!data;
  } else {
    // 세션 쿠키 (실 응시자) 우선 확인
    const cookieStore = await cookies();
    const cookieSessionId = verifySessionCookieValue(
      cookieStore.get(SESSION_COOKIE_NAME)?.value
    );
    if (cookieSessionId) {
      authorized = await isPathInSessionExam(
        supabase,
        cookieSessionId,
        storagePath
      );
    }
    if (!authorized) {
      const user = await getUser();
      authorized = !!user;
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.storage
    .from("exam-attachments")
    .download(storagePath);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: 404 }
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const contentType = data.type || "application/octet-stream";

  const disposition = downloadName
    ? `attachment; filename="${sanitizeAscii(downloadName)}"; filename*=UTF-8''${encodeURIComponent(
        downloadName
      )}`
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

// ASCII 폴백 파일명 (한글 안 지원 브라우저용)
function sanitizeAscii(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
}

/**
 * 세션 exam의 question_sets.attachments 중 storagePath와 일치하는 것이 있는지
 * (경로 위조로 다른 시험 첨부 훔쳐가는 것 방지)
 */
async function isPathInSessionExam(
  supabase: ReturnType<typeof createAdminSupabase>,
  sessionId: string,
  storagePath: string
): Promise<boolean> {
  const { data: session } = await supabase
    .from("exam_sessions")
    .select("exam_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return false;

  const { data: examSets } = await supabase
    .from("exam_sets")
    .select("question_sets(attachments)")
    .eq("exam_id", session.exam_id);
  if (!examSets) return false;

  for (const es of examSets) {
    const qs = (es as { question_sets: { attachments: unknown } | null })
      .question_sets;
    if (!qs || !Array.isArray(qs.attachments)) continue;
    for (const att of qs.attachments as Array<{ path?: string }>) {
      if (att.path === storagePath) return true;
    }
  }
  return false;
}
