import Link from "next/link";

const prototypes = [
  {
    href: "/applicant/waiting/session-me",
    step: "1",
    title: "응시자 대기실",
    tag: "APPLICANT",
    description:
      "환경 체크 (웹캠·마이크·화면공유·CPU·네트워크) → 신분증 업로드 → 보안 서약 → 입실 카운트다운",
    tone: "blue",
  },
  {
    href: "/applicant/exam/session-me",
    step: "2",
    title: "응시 페이지",
    tag: "APPLICANT",
    description:
      "타이머 · 5문항 (객관식·단답·서술형·사례·작업형) · 감독 배지 · 세트별 감독 ON/OFF 배너",
    tone: "emerald",
  },
  {
    href: "/examiner/monitor",
    step: "3",
    title: "감독관 대시보드",
    tag: "EXAMINER",
    description:
      "3단 알림 우선 정렬 (주목·경고·정상) · 실시간 이벤트 타임라인 · 개별 채팅",
    tone: "amber",
  },
];

const toneStyle = {
  blue: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", cta: "bg-blue-600 hover:bg-blue-500" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", cta: "bg-emerald-600 hover:bg-emerald-500" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", cta: "bg-amber-600 hover:bg-amber-500" },
} as const;

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold">
            KB
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              CBT · CERTIFICATION
            </div>
            <div className="text-sm font-semibold text-slate-900">
              kbrain-cert
            </div>
          </div>
          <div className="ml-auto text-[11px] text-slate-500">
            프로토타입 v0.2
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl w-full px-6 py-12">
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
            KBRAIN CERT · OFFICIAL CBT
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3 leading-tight">
            공식 자격 검정을 위한 응시·감독·채점 플랫폼
          </h1>
          <p className="text-slate-600 max-w-2xl leading-relaxed">
            원본 AI Champion을 참고해 승우님(daeasy) 소유로 새로 구축 중인 CBT. 300명 동시 응시,
            세트별 감독 ON/OFF, 100점 환산 통일, 서버 시간 재동기화 타이머를 지원합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {prototypes.map((p) => {
            const t = toneStyle[p.tone];
            return (
              <Link
                key={p.href}
                href={p.href}
                className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md overflow-hidden transition"
              >
                <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/40 flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-md bg-slate-900 text-white text-sm font-bold tabular-nums">
                    {p.step}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${t.bg} ${t.text} ${t.border}`}
                  >
                    {p.tag}
                  </span>
                </div>
                <div className="p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition">
                    {p.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {p.description}
                  </p>
                  <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 group-hover:gap-2 transition-all">
                    열어보기
                    <span>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
            디자인 원칙
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <Principle
              label="배경"
              value="slate-50 → blue-50 그라디언트 · 흰 카드"
            />
            <Principle
              label="카드"
              value="rounded-2xl · shadow-sm · border-slate-200"
            />
            <Principle
              label="색상"
              value="blue-600 CTA · slate-900 배지"
            />
            <Principle
              label="섹션 컬러"
              value="객관식=blue · 단답=emerald · 작업형=amber"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function Principle({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-blue-200 pl-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-slate-700 leading-relaxed">{value}</div>
    </div>
  );
}
