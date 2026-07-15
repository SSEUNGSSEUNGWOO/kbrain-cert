import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

/**
 * 첨부 파일 서버 프록시 fetch
 * - service_role로 private bucket에서 다운로드
 * - Content-Disposition: inline (다운로드 X · 브라우저 내 렌더링)
 * - 로그인 필수 (응시자/감독관/관리자)
 * - GET /api/attachments/exam-blue-1/set-1/{hash}.md
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  await requireAuth(); // 로그인 안 되면 /login 리다이렉트

  const { path } = await params;
  const storagePath = path.join("/");

  const supabase = createAdminSupabase();
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
      "Content-Disposition": "inline", // ⚠️ attachment X · 브라우저 안 렌더
      "Cache-Control": "private, max-age=60",
      // 다운로드 방지 힌트 (강제는 아님)
      "X-Content-Type-Options": "nosniff",
    },
  });
}
