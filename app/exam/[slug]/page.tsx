import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";
import { EntryFlow } from "./entry-flow";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 응시자 진입 페이지 · 인증 없이 접근 (시험 공용 링크)
 * URL: /exam/{slug} · slug 미설정 시 /exam/{examId}(UUID) fallback
 * 진입: 이름 + 전화 뒷4자리 → 명단 매칭 → 세션 생성 + HMAC 쿠키 발급
 */
export default async function ExamEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminSupabase();

  const examQuery = admin
    .from("exams")
    .select("id, title, duration_minutes, exam_date, slug, is_test_mode");
  const { data: exam } = await (UUID_RE.test(slug)
    ? examQuery.eq("id", slug)
    : examQuery.eq("slug", slug)
  ).maybeSingle();
  if (!exam) return notFound();
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (cookieSessionId) {
    const { data: cookieSession } = await admin
      .from("exam_sessions")
      .select("id, exam_id, submit_time")
      .eq("id", cookieSessionId)
      .maybeSingle();
    if (cookieSession && cookieSession.exam_id === exam.id) {
      if (cookieSession.submit_time && !exam.is_test_mode) {
        redirect(`/exam/session/${cookieSession.id}/done`);
      }
      if (!cookieSession.submit_time) {
        redirect(`/exam/session/${cookieSession.id}/take`);
      }
    }
  }

  const examDate = exam.exam_date ? new Date(exam.exam_date) : null;
  const shortId = exam.id.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <>
      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise { animation: rise 800ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>

      <div className="min-h-screen bg-white text-[#0A0A0A] relative overflow-hidden">
        {/* Subtle column rules · 편집지 감각 */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(11,31,58,0.04) 1px, transparent 1px)`,
            backgroundSize: `160px 100%`,
          }}
        />
        {/* Radial vignette · 상단 우측 골드 톤 */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(900px 500px at 92% -10%, rgba(198,156,78,0.08), transparent 60%)",
          }}
        />

        <nav className="relative border-b border-[#0A0A0A]/10">
          <div className="mx-auto max-w-6xl px-6 md:px-10 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative shrink-0">
                <div className="w-11 h-11 bg-[#0B1F3A] flex items-center justify-center text-white font-black text-xl tracking-tighter">
                  k
                </div>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#C69C4E]" />
              </div>
              <div className="leading-tight">
                <div className="font-mono text-[9px] font-bold tracking-[0.3em] uppercase text-[#0A0A0A]/50">
                  National · Certified
                </div>
                <div className="font-bold text-base tracking-tight text-[#0A0A0A]">
                  AI 챔피언 역량평가
                </div>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-4 font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#0A0A0A]/45">
              <span>KBRAIN · CERT</span>
              <span className="w-1 h-1 rounded-full bg-[#0A0A0A]/30" />
              <span>2026 Series</span>
            </div>
          </div>
        </nav>

        <main className="relative mx-auto max-w-6xl px-6 md:px-10 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-14 lg:gap-20">
            {/* LEFT · editorial hero */}
            <section className="relative">
              {/* Watermark number */}
              <div
                aria-hidden
                className="absolute -top-10 -left-2 md:-left-6 font-black text-[180px] md:text-[240px] leading-none text-[#0B1F3A]/[0.05] select-none pointer-events-none tracking-tighter"
              >
                01
              </div>

              <div className="relative rise" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center gap-3 mb-8">
                  <span className="font-mono text-[10px] font-bold tracking-[0.35em] uppercase text-[#8B2635]">
                    N˚ {shortId.slice(0, 4)}·{shortId.slice(4)}
                  </span>
                  <span className="h-px flex-1 bg-[#0A0A0A]/15" />
                  <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#0A0A0A]/50">
                    응시자 로그인
                  </span>
                </div>

                <h1 className="font-black text-[40px] md:text-[56px] lg:text-[68px] leading-[1.02] tracking-[-0.025em] mb-6 text-[#0A0A0A]">
                  {exam.title}
                </h1>

                <div className="flex items-center gap-3 mb-10 flex-wrap">
                  {exam.is_test_mode && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#8B2635] border border-[#8B2635] px-2 py-1">
                      <span className="w-1 h-1 rounded-full bg-[#8B2635] animate-pulse" />
                      Test Mode
                    </span>
                  )}
                  <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#0A0A0A]/45">
                    CBT · Remote Proctored
                  </span>
                </div>
              </div>

              {/* Spec sheet */}
              <div
                className="border-y border-[#0A0A0A]/15 py-6 space-y-3 rise"
                style={{ animationDelay: "150ms" }}
              >
                <SpecRow
                  label="Duration · 시험 시간"
                  value={`${exam.duration_minutes}분`}
                  tabular
                />
                <SpecRow
                  label="Schedule · 응시 일시"
                  value={
                    examDate
                      ? examDate.toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "개별 시작 · Test 상시 개방"
                  }
                  tabular={!!examDate}
                />
                <SpecRow
                  label="Format · 응시 방식"
                  value="원격 감독 · 웹캠 · 화면공유"
                />
                <SpecRow
                  label="Issuer · 시행 기관"
                  value="행정안전부, NIA"
                />
              </div>

              <div
                className="mt-8 max-w-md text-[13.5px] leading-[1.75] text-[#0A0A0A]/70 rise"
                style={{ animationDelay: "250ms" }}
              >
                본 시험은{" "}
                <span className="font-bold text-[#0B1F3A]">
                  공공기관 공식 인증 시험
                </span>
                입니다. 응시 전 명단에 등록된{" "}
                <span className="font-semibold text-[#0A0A0A]">
                  이름과 전화번호 뒷 4자리
                </span>
                를 확인해 주세요. 시험 시작 후 모든 화면은 감독관에게 실시간
                송출됩니다.
              </div>
            </section>

            {/* RIGHT · form */}
            <section
              className="relative lg:pt-4 rise"
              style={{ animationDelay: "300ms" }}
            >
              <div className="lg:sticky lg:top-24">
                <EntryFlow examId={exam.id} />
              </div>
            </section>
          </div>

          <footer
            className="mt-24 pt-8 border-t border-[#0A0A0A]/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rise"
            style={{ animationDelay: "500ms" }}
          >
            <div className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#0A0A0A]/45">
              © 2026 KBrain Cert
              <span className="mx-2 text-[#0A0A0A]/25">·</span>
              Official Assessment Platform
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-[#0A0A0A]/45">
                Support
              </span>
              <span className="w-3 h-px bg-[#0A0A0A]/25" />
              <span className="font-mono font-bold text-[#0A0A0A]">
                databus@nia.or.kr
              </span>
              <span className="text-[#0A0A0A]/25">/</span>
              <span className="font-mono font-bold text-[#0A0A0A]">
                010-0000-0000
              </span>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}

function SpecRow({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string;
  tabular?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-6 items-baseline">
      <div className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase text-[#0A0A0A]/55">
        {label}
      </div>
      <div
        className={`text-[15px] font-medium text-[#0A0A0A] ${
          tabular ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
