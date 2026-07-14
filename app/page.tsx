import Link from "next/link";

const prototypes = [
  {
    href: "/applicant/waiting/session-me",
    num: "01",
    title: "응시자 대기실",
    subtitle: "APPLICANT · WAITING ROOM",
    description:
      "환경 체크 · 신분증 업로드 · 보안 서약 · 입실 카운트다운",
  },
  {
    href: "/applicant/exam/session-me",
    num: "02",
    title: "응시 페이지",
    subtitle: "APPLICANT · EXAM",
    description:
      "타이머 · 5문항 (객관식·단답·서술형·사례·작업형) · 감독 배지 · 세트별 감독 ON/OFF",
  },
  {
    href: "/examiner/monitor",
    num: "03",
    title: "감독관 대시보드",
    subtitle: "EXAMINER · MONITORING",
    description:
      "3단 알림 우선 정렬 · 실시간 이벤트 타임라인 · 개별 채팅 · Daily.co 그리드",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* 상단 브랜드 마크 */}
      <header className="rule-b py-6 px-12 flex items-center gap-4">
        <div className="text-gold text-lg">◆</div>
        <div className="text-xs tracking-[0.3em] font-semibold text-primary">
          KBRAIN CERT
        </div>
        <div className="flex-1" />
        <div className="text-[10px] tracking-widest text-muted-fg">
          PROTOTYPE · v0.1 · M0
        </div>
      </header>

      {/* 히어로 */}
      <section className="py-24 px-12">
        <div className="max-w-5xl">
          <div className="text-[10px] tracking-[0.4em] text-gold mb-6">
            OFFICIAL CERTIFICATION SYSTEM
          </div>
          <h1 className="font-serif text-5xl leading-tight mb-8">
            공식 자격 검정을 위한
            <br />
            엄격한 응시·감독·채점 플랫폼.
          </h1>
          <div className="max-w-2xl text-base leading-relaxed text-muted-fg">
            브라우저 로컬 감독 · Daily.co 실시간 관찰 · R2 전면 녹화 · 3단 알림 정렬을
            통합하여, 300명 동시 응시 규모에서도 공식 자격증급 검정 신뢰도를 유지합니다.
          </div>
        </div>
      </section>

      {/* 3개 프로토타입 */}
      <section className="px-12 pb-24">
        <div className="rule-t-gold pt-2 mb-10">
          <div className="text-[10px] tracking-[0.4em] text-gold">
            PROTOTYPES
          </div>
        </div>

        <div className="divide-y divide-[--color-line]">
          {prototypes.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-baseline gap-10 py-8 hover:surface-hover transition px-4 -mx-4"
            >
              <div className="gutter-numeral text-6xl flex-shrink-0 w-20 group-hover:text-gold transition">
                {p.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[0.35em] text-gold mb-2 font-semibold">
                  {p.subtitle}
                </div>
                <div className="font-serif text-2xl font-bold text-primary mb-2 group-hover:text-gold-strong transition">
                  {p.title}
                </div>
                <div className="text-sm text-muted-fg leading-relaxed">
                  {p.description}
                </div>
              </div>
              <div className="flex-shrink-0 self-center text-2xl text-muted group-hover:text-gold group-hover:translate-x-1 transition">
                →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 하단 원칙 */}
      <footer className="mt-auto rule-b px-12 py-8">
        <div className="max-w-5xl grid grid-cols-4 gap-8 text-[11px] leading-relaxed">
          <Principle label="TONE" value="Dark Premium · Gold Accent" />
          <Principle label="TYPE" value="Pretendard 900 · Noto Serif KR" />
          <Principle label="LAYOUT" value="Rule-line · Big Gutter Numerals" />
          <Principle label="RADIUS" value="0~2px · Angular" />
        </div>
      </footer>
    </div>
  );
}

function Principle({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.4em] text-gold mb-1.5">
        {label}
      </div>
      <div className="text-muted-fg">{value}</div>
    </div>
  );
}
