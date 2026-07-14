# kbrain-cert

승우님(daeasy)의 공식 자격증급 CBT 플랫폼. 동시 응시 300명 지원.

**주요 특징**:
- 세트별 감독 ON/OFF (원본 오탐 이슈 해결)
- 정답 필드가 클라이언트에 애초에 도달하지 않는 이중 격리
- 100점 환산 표시 통일
- 타이머 서버 시간 재동기화 재시도

**외부 통합**: Supabase(DB · Auth) · Daily.co(감독관 실시간 화상) · Cloudflare R2(응시 녹화) · Resend(초대 이메일)

**상태**: M0 완료 (2026-07-14) · 계획 확정 · M1 스캐폴딩 대기

## 문서

- [MASTER_PLAN.md](docs/MASTER_PLAN.md) — 마일스톤 M0~M6, 확정사항, 미결정
- [FEATURES.md](docs/FEATURES.md) — 역할별 기능 (Admin · Examiner · Grader · Applicant)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — 스택·데이터 모델·300명 부하·외부 통합
- [INVENTORY.md](docs/INVENTORY.md) — 원본(AI Champion) 기능 카탈로그
- [DECISIONS.md](docs/DECISIONS.md) — 이식 방향 8개 확정 결정

## 다음 단계

M1 스캐폴딩 진입 전 미결정 5개 확정 → `create-next-app` + Supabase/Daily/R2/Resend 계정 세팅.
