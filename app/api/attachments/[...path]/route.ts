import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

/**
 * 첨부 파일 서버 프록시 fetch
 *
 * 인증 두 방식:
 * 1) 로그인된 사용자 → 통과
 * 2) ?practice=<slug> · 유효한 practice_slug면 · 로그인 없이 통과 (테스트 링크)
 *
 * 응답 모드:
 * - 기본: Content-Disposition: inline (브라우저 내 렌더)
 * - ?download=<filename>: Content-Disposition: attachment (파일 저장) · 한글 UTF-8 인코딩
 *
 * GET /api/attachments/exam-blue-1/set-1/{hash}.md
 * GET /api/attachments/exam-blue-1/set-1/{hash}.md?practice=058cbc1d7db4
 * GET /api/attachments/exam-blue-1/set-1/{hash}.md?download=부서_사전.json
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
    const user = await getUser();
    authorized = !!user;
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
