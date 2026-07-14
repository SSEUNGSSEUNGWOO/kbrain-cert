import Link from "next/link";

const prototypes = [
  {
    href: "/applicant/waiting/session-me",
    step: "1",
    title: "응시자 대기실",
    description:
      "환경 체크 (웹캠·마이크·화면공유·CPU·네트워크) → 신분증 업로드 → 보안 서약 → 입실 카운트다운",
    tag: "APPLICANT",
  },
  {
    href: "/applicant/exam/session-me",
    step: "2",
    title: "응시 페이지",
    description:
      "타이머 · 문제 5문항 (객관식·단답·서술형·사례·작업형) · 감독 배지 · 세트별 감독 ON/OFF 배너 · 워터마크",
    tag: "APPLICANT",
  },
  {
    href: "/examiner/monitor",
    step: "3",
    title: "감독관 대시보드",
    description:
      "30명 응시자 그리드 · 실시간 감독 이벤트 타임라인 · 심각도 색상 시스템 · 스트리밍 상태",
    tag: "EXAMINER",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 items-start justify-center py-24 px-8">
      <div className="w-full max-w-4xl">
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 mb-6 text-xs font-medium tracking-widest text-muted uppercase">
            <span className="w-1 h-1 rounded-full bg-accent" />
            kbrain-cert · Prototype
          </div>
          <h1 className="text-4xl mb-4">
            공식 자격 검정 플랫폼
            <span className="block text-lg font-normal text-muted mt-3 leading-relaxed">
              M0 계획을 반영한 초기 시안입니다. 브랜드 톤 (짙은 네이비 · Pretendard · 좁은 radius · 절제된 border)과
              핵심 흐름 3개를 실제 컴포넌트로 확인하세요.
            </span>
          </h1>
        </div>

        <div className="grid gap-3">
          {prototypes.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group border border-[--color-border] hover:border-strong bg-white transition rounded-md p-6 flex gap-6 surface-hover"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-tabular text-lg">
                {p.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 mb-2">
                  <h2 className="text-xl">{p.title}</h2>
                  <span className="text-[10px] font-semibold tracking-widest text-muted-fg">
                    {p.tag}
                  </span>
                </div>
                <p className="text-sm text-muted-fg leading-relaxed">
                  {p.description}
                </p>
              </div>
              <div className="flex-shrink-0 self-center text-muted group-hover:text-primary transition">
                →
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-[--color-border] text-xs text-muted-fg leading-relaxed">
          <div className="mb-2 font-semibold text-primary">디자인 시스템 원칙</div>
          <ul className="space-y-1 list-disc pl-4">
            <li>Primary: 짙은 네이비 (hsl 222 47% 11%) · 신뢰·공식감</li>
            <li>배경: 순백 + surface-muted (미묘한 warm gray) · 그림자보다 border</li>
            <li>Radius: 2~8px 좁은 범위 · 각진 편이 공식 문서에 어울림</li>
            <li>Font: Pretendard Variable (한글) · JetBrains Mono (숫자·타이머)</li>
            <li>감독 색상: 위반은 danger(진홍) · 경고는 warning(앰버) · 정보는 info(짙은 파랑)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
