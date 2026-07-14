# kbrain-cert — 마스터 플랜

**최종 갱신**: 2026-07-14
**소유자**: 승우님 (ohjieun25@daeasy.co.kr)
**한 줄 요약**: 300명 동시 응시 가능한 CBT(Computer-Based Testing) 플랫폼. 원본 "AI Champion Certification System"(Lovable 제작 · 남의 코드)을 참고만 하여 처음부터 새로 구축.

---

## 확정 사항

| 항목 | 값 |
|---|---|
| 프로젝트명 | `kbrain-cert` |
| 코드 위치 | `C:\Dev\kbrain\kbrain-cert` (kbrain 하위, kbrain-ems와 형제) |
| 프론트/백엔드 | **Next.js 15 (App Router) + TypeScript** |
| UI | **shadcn/ui + Tailwind CSS** |
| DB · Auth · Storage | **Supabase (프로젝트 신규: `kbrain-cert-dev`, `kbrain-cert-prod` 별도)** |
| E2E 테스트 | **Playwright** |
| 감독 방식 | **브라우저 로컬 추론 + 서버는 이벤트 로그만 수집** (얼굴/음성/화면) |
| 최대 부하 스펙 | **동시 응시 300명** (자세한 처리 방식은 `ARCHITECTURE.md`) |
| Git | 로컬 `git init`만. 원격(GitHub) 나중에 |
| 원본 코드 관계 | 참고만. 이식·복사 안 함 |

---

## 원본에서 이어받되 근본적으로 개선할 4가지 (원본 plan.md 반영)

| # | 원본 이슈 | 새 시스템 처리 방식 | 상세 |
|---|---|---|---|
| 1 | 감독 민감도 — 생성형AI 작업형 등 외부 도구 허용 구간에서 오탐 | 문제 세트 단위 `proctoring_disabled` 플래그를 **스키마 최초 설계부터 포함** | `FEATURES.md` §관리자 · §응시자 |
| 2 | 응시자 화면에 정답 노출 (운영자 실수로 placeholder에 정답 입력) | **정답·rubric은 애초에 클라이언트로 내려가지 않음** (서버 컴포넌트/서버 액션 격리 + RLS) — 원본은 클라 sanitize 방식 | `ARCHITECTURE.md` §데이터 격리 |
| 3 | 원점수(174/300)와 100점 환산(75) 표시 혼용 | **표시·판정은 항상 (raw/max)*100, 저장은 raw**를 단일 규칙으로 코드베이스 전역 강제 | `FEATURES.md` §채점 |
| 4 | 타이머 `start_time` 누락 시 즉시 자동제출 (버그) | **서버 시간 재동기화 3회 재시도 후 자동제출**, 절대시간 모드 `isNaN` 가드 | `FEATURES.md` §응시 |

---

## 마일스톤

### M0 — 계획 정리 (오늘)
- [x] 폴더 생성
- [x] 계획 문서 3종 (`MASTER_PLAN`, `FEATURES`, `ARCHITECTURE`)
- [x] git 로컬 저장소 초기화
- **검증**: 승우님이 계획 3종 리뷰 후 승인

### M1 — 스캐폴딩 & 인프라 (1~2일 예상)
- Next.js 15 + TS + Tailwind + shadcn/ui 초기화
- 라우트 그룹: `app/(admin)`, `app/(applicant)`, `app/(grader)`, `app/api`
- Supabase 프로젝트 신규 2개 생성 → env 세팅 (`.env.local` / `.env.production`)
- Supabase Auth (관리자 · 응시자 · 채점자 3역할 · RLS 기본 정책)
- **검증**: 로컬 dev 서버 기동, 3역할 로그인 페이지 접속 가능

### M2 — 문제은행 & 세트 관리 (관리자)
- 스키마: `questions`, `question_sets`, `question_set_items`, `proctoring_disabled` 컬럼 최초 포함
- JSON 업로드 파서 + `placeholder == correct_answer` 경고
- 정답·rubric은 서버에서만 접근 (RLS + Server Component)
- **검증**: 관리자가 문제 세트 업로드/편집 → 응시자용 API 응답에 정답 필드 존재하지 않음(Playwright 검증)

### M3 — 응시 (응시자)
- 타이머: 서버 시간 재동기화 + `start_time` 누락 시 3회 재시도
- 감독: face-api.js(로컬) + 음성 볼륨(WebAudio API) + FullscreenGuard, Supabase Realtime으로 이벤트 배치 전송
- 세트별 `proctoring_disabled=true`면 감독 배지 표시 + 감독 컴포넌트 unmount
- 답안 저장: debounce 3s + 명시적 저장 버튼
- **검증**: 시나리오 4개 Playwright — 정상 응시 / 감독 트리거 / 감독 비활성 세트 진입 / 시간 재동기화

### M4 — 채점 & 결과
- 자동채점(객관식/단답) + 수동채점(작업형)
- **모든 점수 표시 = (raw/max)*100** 헬퍼 함수로 강제
- CSV export, 결과 페이지, 합격 판정
- **검증**: 원점수 174/300 → 환산 58/100 표시 일관성 Playwright 검증

### M5 — 부하 검증 & 튜닝
- Playwright + 스크립트로 300 동시접속 스모크
- Supabase 커넥션 풀(PgBouncer transaction mode) · Realtime 채널 · Vercel Edge Config 튜닝
- **검증**: 300명 응시 시 p95 응답 시간 · 답안 저장 유실 0건

---

## 미결정 (M1 진입 전에 확정 필요)

- GitHub private repo 만들 시점 (현재는 로컬만)
- Vercel 프로젝트/도메인 명 (임시로 `kbrain-cert.vercel.app`)
- 결제/유료화 여부 (사내용이면 불필요. 향후 외부 판매 시 재검토)
- 얼굴 인식 모델 선택 (face-api.js vs MediaPipe Face Detection)
