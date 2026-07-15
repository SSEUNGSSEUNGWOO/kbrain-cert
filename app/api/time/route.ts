import { NextResponse } from "next/server";

/**
 * 네트워크 응답 시간 측정 및 서버 시간 동기화용
 * - Practice 페이지 환경 체크에서 3회 fetch로 평균 지연 측정
 * - 실전 응시 페이지에서 타이머 서버 시간 동기화 (NTP 스타일)
 */
export function GET() {
  return NextResponse.json(
    { now: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
