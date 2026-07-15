import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

/**
 * 첨부 파일 서버 프록시 fetch
 * - service_role로 private bucket에서 다운로드
 * - Content-Disposition: inline (다운로드 X · 브라우저 내 렌더링)
 *
 * 인증 두 가지 방식:
 * 1) 로그인된 사용자 (관리자·응시자·감독관·채점자) → 통과
 * 2) ?practice=<slug> · 유효한 practice_slug면 · 로그인 없이 통과 (테스트 링크용)
 *
 * GET /api/attachments/exam-blue-1/set-1/{hash}.md
 * GET /api/attachments/exam-blue-1/set-1/{hash}.md?practice=058cbc1d7db4
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = path.join("/");
  const { searchParams } = new URL(request.url);
  const practiceSlug = searchParams.get("practice");

  // 인증 검증
  const supabase = createAdminSupabase();
  let authorized = false;

  if (practiceSlug) {
    // practice mode - slug 유효성만 확인
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

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
