# kbrain-cert — 마스터 플랜

**최종 갱신**: 2026-07-14
**소유자**: 승우님 (ohjieun25@daeasy.co.kr)
**한 줄 요약**: 100명 동시 응시(120분·회당) 공식 자격증급 CBT 플랫폼. 원본 "AI Champion Certification System"(Lovable · 남의 코드)에서 기능 방향을 가져와 Next.js로 새로 구축. 원본 대비 개선점 4개(감독 유연성·정답 격리·점수 통일·타이머).

---

## 확정 사항

| 항목 | 값 |
|---|---|
| 프로젝트명 | `kbrain-cert` |
| 코드 위치 | `C:\Dev\kbrain\kbrain-cert` |
| 프론트/백엔드 | **Next.js 15 (App Router) + TypeScript** |
| UI | **shadcn/ui + Tailwind CSS** |
| DB · Auth · Storage · Realtime | **Supabase Pro** (신규 프로젝트 2개: dev / prod) |
| E2E 테스트 | **Playwright** + **Vitest** (unit) |
| 배포 | **Vercel** (Frontend) |
| **화상회의 (감독관 실시간 관찰)** | **Agora Web SDK** (Seoul 리전 · SD simulcast) — 2026-07-14 Daily.co에서 재확정 |
| **응시 녹화** | **Cloudflare R2** (웹캠·화면 청크 저장) |
| **이메일 발송 (초대·OTP)** | **Resend** (원본 방식, 승우님 재확인 필요) |
| **본인 인증** | **신분증 이미지 업로드 → 관리자 사후 검토** (AWS Rekognition 미사용) |
| **응시자 등록** | **초대전용 메인** (관리자 명단 업로드 → 이메일 OTP) |
| **감독 방식** | 브라우저 로컬 추론(얼굴·음성·화면) + 서버 이벤트 로그 + Agora 실시간 스트림 + R2 녹화 |
| **문제 유형** | **작업형(work_based, 슬롯형) 한 종류만** (결정 I) — 슬롯 조합: text · long_text · url · file · number |
| **자동채점 범위** | **없음** (결정 I 파급) — 모든 문항이 작업형이라 자동채점 대상 없음. 슬롯별 수동채점 + 답안 CSV/JSON export로 외부 위임 |
| **인증서 발급** | 제외 (시험 응시·채점까지만) |
| **카테고리·등급** | 관리자 설정 테이블 (하드코딩 해제) |
| 최대 부하 스펙 | **동시 응시 100명 · 120분 · 회당** (2026-07-14 축소 · 초기 300명 가정에서 조정) |
| Git | 로컬 `git init`만. 원격 나중에 |
| 원본 코드 관계 | 참고만. 이식·복사 안 함 |

**세부 결정 근거**: `DECISIONS.md`
**원본 기능 카탈로그**: `INVENTORY.md`
**기능 리스트**: `FEATURES.md`
**아키텍처**: `ARCHITECTURE.md`

---

## 원본에서 이어받되 근본적으로 개선할 4가지

| # | 원본 이슈 | 새 시스템 처리 방식 |
|---|---|---|
| 1 | 감독 민감도 — 생성형AI 작업형에서 오탐 | 문제 세트 단위 `proctoring_disabled` 플래그 (스키마 최초 설계부터 포함) — 결정 I로 **모든 문항이 작업형**이 되어 세트별 정책 결정이 더 중요해짐 |
| 2 | 응시자 화면에 정답 노출 | **결정 I 파급으로 근본 사라짐** — 자동채점 자체가 없어 노출할 정답이 존재하지 않음. `rubric`(채점 기준)만 서버 격리 |
| 3 | 원점수 vs 100점 환산 표시 혼용 | `lib/grading/score.ts` 단일 헬퍼(`toPercentage(raw, max)`)로 전역 강제. 저장은 raw |
| 4 | 타이머 `start_time` 누락 시 즉시 자동제출 | 서버 시간 재동기화 3회 재시도 후 자동제출 + 절대시간 `isNaN` 가드 |

---

## 마일스톤

### M0 — 계획 정리 ✅ (2026-07-14 완료)
- [x] 폴더 생성, `git init`
- [x] 계획 문서 5종 (`MASTER_PLAN`, `FEATURES`, `ARCHITECTURE`, `INVENTORY`, `DECISIONS`)
- [x] 이식 스코프 확정

### M1 — 스캐폴딩 & 외부 서비스 세팅 (3~5일)
- `create-next-app` + TS + Tailwind + shadcn/ui init
- 라우트 그룹 6개: `(auth)`, `(admin)`, `(applicant)`, `(examiner)`, `(grader)`, `api`
- Supabase 프로젝트 신규 2개 생성 → RLS 기본 정책 + 4역할(admin/examiner/grader/applicant)
- **Agora 계정 · Seoul 프로젝트 생성 · App ID/Certificate 발급**
- **Cloudflare R2 버킷 생성 · SigV4 credential**
- **Resend 계정 · 발신 도메인 인증** (또는 Supabase Auth 내장으로 결정)
- 환경 변수 통합 세팅
- **검증**: 로컬 dev 서버 기동, 각 외부 서비스 헬로월드 (Daily 룸 생성 · R2 파일 업로드 · Resend 테스트 메일)

### M2 — 문제은행 & 세트 관리 + 커스터마이징 (3~5일, **작업형 전용으로 축소**)
- 스키마 마이그레이션 최초 세트:
  - `questions` (작업형 전용 · `submission_slots` 필수), `question_sets`, `question_set_items`, `question_categories`(신규), `exam_grades`(신규)
  - ⚠️ `question_sets.proctoring_disabled` 컬럼 최초 포함
- **관리자 페이지**: 문제 CRUD (슬롯 편집기 하나만) · JSON/CSV 대량 업로드
- 슬롯 편집기: 슬롯 타입 5종(text · long_text · url · file · number) 조합, 라벨 · max_score · accept 지정
- ⚠️ `rubric`만 서버 컴포넌트 격리 + `questions_for_applicant` RLS 뷰 (정답 컬럼 없어 격리 대상 축소)
- 카테고리·등급 관리 페이지 (하드코딩 해제)
- 태그·검색·필터
- 문제 변경 이력 로그
- **검증**: Playwright — 응시자용 API 응답에 `rubric` 없음을 확인

### M3 — 시험 관리 + 초대 시스템 (4~6일)
- **관리자 시험 관리**: 시험 CRUD, 세트 조합, 절대/상대/테스트 모드, `entry_start_minutes`, `alert_event_types`, `custom_texts`, `pass_score`
- **초대전용 흐름**:
  - 관리자가 명단 CSV 업로드 → `exam_invitations` 생성
  - Resend로 초대코드 + 상시링크 이메일 발송
  - 응시자는 링크 진입 → 이메일 OTP 검증 → 세션 생성
- 응시자 개별 예외(듀얼 모니터 허용·웹캠 없음 허용) 설정
- **검증**: 초대 발송→링크 진입→OTP 검증→응시 세션 생성 end-to-end

### M4 — 응시 & 감독 & 녹화 (7~10일, 가장 무거움)
- **대기실**: 환경 체크(웹캠·마이크·화면공유·CPU 벤치마크), 보안 서약, **신분증 이미지 업로드**(Rekognition 없음), 입실 타이밍
- **응시 페이지**:
  - 타이머 (⚠️ `start_time` 재시도 로직)
  - 문제 렌더러 — Markdown + **슬롯형 답안 컴포넌트 하나** (5유형 분기 없음)
  - 슬롯 컴포넌트: text · long_text · url · file · number 처리, 파일은 R2 presigned 직접 업로드
  - 문항별 제출 체크리스트 (kbrain-ems 방식 참고 · 슬롯 채워짐 자동 체크)
  - 답안 자동 저장 (debounce 3s + IndexedDB 로컬 백업)
- **로컬 감독**:
  - face-api.js (얼굴·다인원)
  - WebAudio (음성)
  - FullscreenGuard + Page Visibility
  - EventBatcher (5s 배치) → `/api/proctoring/events`
  - ⚠️ 세트 `proctoring_disabled` 시 감독 unmount + 배너
- **Agora 통합**: 응시자 웹캠·화면공유 → 감독관 그리드 뷰용 SFU 스트림. 감독관↔응시자 채팅은 Supabase Realtime 자체 구현
- **R2 녹화**: MediaRecorder 500ms 청크 → `r2-presign` → R2 직접 업로드 (실패 재시도)
- **검증**: Playwright 시나리오 5개 — 정상 응시 / 감독 트리거 / 감독 비활성 세트 / 시간 재동기화 / 녹화 실패 재시도

### M5 — 감독관 대시보드 + 채점 + 답안 Export + 결과 (5~7일)
- **감독관 페이지**:
  - `MonitorDashboard` — 진행 중 응시자 그리드 (Daily 스트림 썸네일), 이벤트 알림 토스트
  - `EventLogPage` — 감독 이벤트 조회·필터
  - 공지·개별 채팅, 강제 종료·시간 연장
  - 녹화 재생 (`RecordingReviewPage`)
- **채점** (모두 수동, 결정 I):
  - 자동채점 없음 — 관련 UI·로직·큐 전부 제거
  - 슬롯별 부분 점수 + 코멘트 입력 인터페이스
  - 첨부 파일 미리보기 (텍스트/이미지/코드 하이라이트)
  - ⚠️ 모든 점수 표시 (raw/max)*100 (이슈 #3)
- **답안 Export (핵심 기능화)**:
  - 시험/응시자/문제 기준 CSV·JSON export + 첨부 파일 zip 묶음
  - 외부 CLI·다른 채점자·AI 도구 위임용
  - Import 시 원 attempt에 점수·코멘트 반영
- **결과**: 응시자 결과 페이지, 관리자 통계 대시보드, CrossTable xlsx export
- **검증**: 원점수 174/300 → 환산 58/100 표시 일관성, export 라운드트립 검증

### M6 — 부하 검증 & 폴리싱 (3~5일)
- Playwright 다중 세션 스모크 (WebRTC 제외 API 부분만)
- **실기기 다중 노트북 리허설** (Daily·녹화 실부하)
- Supabase PgBouncer transaction mode, Realtime 채널 튜닝
- 감독 이벤트 파티셔닝, `attempts`·`answers` 인덱스 튜닝
- Vercel Edge Config, 캐시 태그 revalidation
- 접근성 · 반응형 · 크로스브라우저 (Chrome · Edge 필수)
- **검증**: 100명 동시 응시 리허설 시 답안 유실 0건, 감독 이벤트 유실률 < 0.1% (실기기 리허설은 30~50명 규모)

---

## 예상 총 기간

M0(완료) + M1(3~5일) + M2(5~7일) + M3(4~6일) + M4(7~10일) + M5(5~7일) + M6(3~5일) = **27~40일** (풀타임 기준). 승우님 다른 프로젝트(kbrain-ems, dataeasy)와 병행하면 훨씬 늘어남.

---

## 미결정 (M1 진입 전 최종 확정)

1. ~~Daily.co 구독 플랜~~ → **Agora 확정 (2026-07-14)**. agora.io 계정·프로젝트 생성 필요
2. **Cloudflare R2 계정 명의** — 개인/daeasy
3. **이메일 발송 채널** — Resend vs Supabase Auth 내장
4. **얼굴 감지 모델** — face-api.js 유지 vs MediaPipe
5. **응시 녹화 보관 기간** — 30일 / 6개월 / 1년 (R2 비용에 직결)
6. **GitHub private repo 생성 시점**
7. **Vercel 프로젝트 도메인** (임시 `kbrain-cert.vercel.app`)
