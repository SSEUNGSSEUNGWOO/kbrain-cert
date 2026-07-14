# kbrain-cert — 아키텍처

**핵심 목표**: 동시 응시 300명이 시험 진행하는 동안 답안 유실 0건, p95 응답 시간 500ms 이하 유지.

---

## 기술 스택

| 레이어 | 기술 | 선택 이유 |
|---|---|---|
| Frontend / Backend | **Next.js 15 (App Router) + TypeScript** | 서버 컴포넌트로 정답 격리, Server Actions로 채점 로직 서버 격리, kbrain-ems·dataeasy와 스택 통일 |
| UI | **shadcn/ui + Tailwind CSS + Radix Primitives** | 원본과 동일 라이브러리 → 컴포넌트 참고 이식 쉬움 |
| 상태 관리 | **React Query (TanStack Query) v5** | 서버 상태 캐싱, 답안 저장 debounce · retry에 유리 |
| DB · Auth · Storage · Realtime | **Supabase (Pro 티어)** | RLS로 응시자 데이터 격리, Realtime으로 감독 이벤트 · 답안 sync |
| 감독 (얼굴) | **face-api.js (TensorFlow.js)** | 브라우저 로컬 추론, 서버 부담 0 |
| 감독 (음성) | **WebAudio API (native)** | 브라우저 native, 라이브러리 없음 |
| 감독 (화면) | **Fullscreen API · Page Visibility API** | 브라우저 native |
| E2E 테스트 | **Playwright** | 원본과 동일, 다중 세션 부하 시뮬레이션도 가능 |
| 단위 테스트 | **Vitest** | Next.js 15 호환, 빠름 |
| 배포 | **Vercel (Frontend) + Supabase (Backend)** | 서버리스, 자동 스케일링 |
| 코드 품질 | **ESLint (flat config) + Prettier + TypeScript strict** | |

---

## 폴더 구조

```
kbrain-cert/
├── app/
│   ├── (admin)/                # 관리자 라우트 그룹
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── questions/          # 문제은행
│   │   ├── question-sets/      # 세트 (proctoring_disabled 포함)
│   │   ├── exams/              # 시험 관리
│   │   ├── monitor/            # 실시간 모니터링
│   │   ├── grading/            # 채점 관리
│   │   └── results/            # 결과·통계
│   ├── (applicant)/            # 응시자 라우트 그룹
│   │   ├── layout.tsx
│   │   ├── waiting/[examId]/   # 대기실
│   │   ├── exam/[examId]/      # 응시 (타이머 · 감독)
│   │   └── result/[examId]/    # 결과 확인
│   ├── (grader)/               # 채점자 라우트 그룹
│   │   ├── layout.tsx
│   │   └── queue/              # 채점 대기열
│   ├── (auth)/
│   │   ├── login/
│   │   └── callback/
│   └── api/
│       ├── proctoring/events/  # 감독 이벤트 배치 수신
│       └── exam/submit/        # 최종 제출
├── components/
│   ├── ui/                     # shadcn 생성물
│   ├── proctoring/             # FullscreenGuard, FaceMonitor, VoiceMonitor
│   ├── exam/                   # QuestionRenderer, Timer, Navigator
│   ├── admin/                  # 관리자 전용 위젯
│   └── grader/
├── lib/
│   ├── supabase/               # server / client / middleware
│   ├── grading/                # 점수 계산 (raw ↔ 100점 환산 헬퍼)
│   ├── proctoring/             # 감독 이벤트 배치 · Realtime
│   └── time/                   # 서버 시간 동기화 · 타이머 로직
├── types/                      # DB 스키마 타입 (supabase gen types)
├── supabase/
│   ├── migrations/
│   └── config.toml
├── e2e/                        # Playwright
├── docs/                       # 현재 계획 문서들
├── public/
├── .env.local.example
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 데이터 모델 (핵심 테이블 초안)

```sql
-- 문제
questions (
  id uuid pk,
  type text check (type in ('mcq','short','essay','task')),
  prompt text,
  choices jsonb,             -- 객관식
  correct_answer jsonb,      -- 서버 전용 (RLS로 응시자 access 차단)
  rubric jsonb,              -- 서버 전용
  max_score numeric,
  created_by uuid, created_at timestamptz
)

-- 문제 세트
question_sets (
  id uuid pk,
  title text,
  proctoring_disabled boolean not null default false,  -- ⚠️ 최초 설계부터 포함
  created_by uuid, created_at timestamptz
)

question_set_items (
  set_id uuid fk,
  question_id uuid fk,
  order_index int,
  primary key (set_id, question_id)
)

-- 시험
exams (
  id uuid pk,
  title text,
  mode text check (mode in ('absolute','relative')),
  exam_date timestamptz,     -- absolute 모드
  duration_minutes int,      -- relative 모드
  passing_score int,         -- (100점 환산 기준)
  created_by uuid
)

exam_sets (
  exam_id uuid fk,
  set_id uuid fk,
  order_index int,
  primary key (exam_id, set_id)
)

-- 응시
attempts (
  id uuid pk,
  exam_id uuid fk,
  applicant_id uuid fk,
  start_time timestamptz,
  submit_time timestamptz,
  auto_submitted boolean default false,
  status text check (status in ('pending','in_progress','submitted','graded'))
)

answers (
  attempt_id uuid fk,
  question_id uuid fk,
  response jsonb,
  raw_score numeric,          -- 저장은 raw만
  graded_by uuid, graded_at timestamptz,
  primary key (attempt_id, question_id)
)

-- 감독 이벤트
proctoring_events (
  id bigserial pk,
  attempt_id uuid fk,
  event_type text,
  payload jsonb,
  occurred_at timestamptz,
  severity text
)
-- 파티셔닝: attempt_id 기준 monthly partition (300명 * 이벤트 다수 → 커짐)
```

**표시·판정 규칙 (강제)**: `lib/grading/score.ts`에 `toPercentage(raw, max)` 헬퍼 하나만 두고, 화면·CSV·DB view는 반드시 이 함수를 통해서만 100점 환산. 저장은 raw 유지.

---

## 데이터 격리 (원본 이슈 #2 근본 해결)

**원본의 문제**: 응시자용 API가 문제 전체를 내려주고, 클라이언트에서 `correct_answer`/`rubric`을 sanitize. 운영자가 실수로 `submission_slots[].placeholder`에 정답을 넣으면 그대로 노출.

**kbrain-cert 처리**:

1. **RLS 정책 레벨**
   - `questions` 테이블에 응시자용 컬럼 셀렉트를 제한하는 뷰 `questions_for_applicant`를 만들고, applicant role은 이 뷰만 접근 가능
   - 뷰는 `correct_answer`, `rubric` 컬럼 제외
2. **서버 컴포넌트**
   - `app/(applicant)/exam/[examId]/page.tsx`는 서버 컴포넌트에서 뷰를 통해 페치, 클라에는 sanitize 된 payload만 전달
3. **업로드 파서 가드**
   - JSON 업로드 시 `submission_slots[].placeholder == correct_answer` 검사 → 경고 토스트

두 계층으로 방어. 관리자가 실수해도 클라에 정답이 존재하지 않음.

---

## 300명 동시 응시 처리

### 병목 예상 지점 & 대응

| 병목 | 예상 부하 | 대응 |
|---|---|---|
| 시험 시작 순간 문제 페치 300 요청 폭주 | 300 req/s (수 초 내) | Next.js `revalidate` 캐시 + Supabase RLS 뷰 응답을 Vercel Edge Cache로 캐싱 (문제 payload는 응시자 공용) |
| 답안 저장 (문제당 debounce 3s) | 300명 * 개당 문제 = 지속적 write | React Query mutation + `PATCH /answers` upsert, Supabase PgBouncer transaction mode 커넥션 풀 |
| 감독 이벤트 (초당 다수) | 최악 300명 * 초당 2개 = 600 write/s | 클라에서 **5초 단위 배치**로 묶어 `POST /api/proctoring/events` 1번만. 서버는 bulk insert |
| 실시간 응시 모니터링 (관리자) | Realtime 구독 확산 | 관리자 대시보드는 5초 폴링(Realtime 대신), 상세 진입 시에만 Realtime 채널 개별 구독 |
| 최종 제출 순간 폭주 | 시험 종료 시각 근처 300 요청 동시 | 서버 액션에서 idempotency key(`attempt_id`) 강제, 재시도 안전 |

### Supabase 티어

- **Pro 티어 필요** (동시 커넥션 200+ · Realtime 채널 제한 상향 · PgBouncer 지원)
- 감독 이벤트 테이블은 `attempt_id` 기준 monthly partitioning
- Read replica는 초기엔 불필요, M5 부하테스트 결과 보고 판단

### Vercel

- Edge Runtime: 인증 미들웨어, 감독 이벤트 수신 API
- Node Runtime: 채점, 파일 처리
- 문제 payload는 `unstable_cache` + tag revalidation

### 클라이언트 최적화

- 문제 세트 전체를 초기 1회에 로드 (오프라인/네트워크 순단 대비)
- 답안은 IndexedDB에 로컬 백업 → 네트워크 복구 시 sync
- face-api.js 모델은 CDN 캐시, 첫 로드 이후 재사용

---

## 시간 동기화 (원본 이슈 #4 대응)

`lib/time/serverClock.ts`:

```ts
// 응시 시작 시 서버 시간 오프셋 계산
const serverTime = await fetch('/api/time').then(r => r.json());
const offset = serverTime - Date.now();

// 타이머는 (Date.now() + offset)으로 계산
```

`start_time` 누락 시 처리:

```ts
async function recomputeTimeLeft(attempt) {
  if (!attempt.start_time) {
    for (let i = 0; i < 3; i++) {
      toast('시간 동기화 재시도 중… (' + (i+1) + '/3)');
      const fresh = await refetchAttempt();
      if (fresh.start_time) return computeFrom(fresh);
      await sleep(2000);
    }
    return autoSubmit();  // 3회 실패 후에만
  }
  return computeFrom(attempt);
}
```

절대시간 모드는 `exam_date` 파싱 후 `isNaN(date.getTime())` 가드.

---

## 감독 아키텍처 (원본 이슈 #1 대응)

```
[Browser]
  ├─ FaceMonitor (face-api.js, 500ms interval)
  ├─ VoiceMonitor (WebAudio RMS, 200ms interval)
  ├─ FullscreenGuard (event listener)
  │
  └─ EventBatcher (5초 window)
        │
        └─→ POST /api/proctoring/events (bulk)
              │
              └─→ Supabase bulk insert → proctoring_events
                    │
                    └─→ Realtime channel → 관리자 상세 뷰
```

**세트별 비활성화**:
- `currentQuestion.set.proctoring_disabled === true`이면 감독 3개 컴포넌트 unmount + EventBatcher 정지
- 상단 배너 렌더
- 다음 세트로 이동 시 자동 재활성화 (컴포넌트 remount)

---

## 환경 변수 (초안)

```
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # 서버 전용 (RLS bypass — 채점·집계용)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 알려진 리스크

| 리스크 | 대응 |
|---|---|
| face-api.js 모델 크기(~10MB) → 첫 로드 지연 | Vercel Edge Cache + Service Worker precache |
| 300명 동시 시험 시작이 특정 초에 몰림 → thundering herd | 응시자별 시작 시각 랜덤 지연(±3s) 옵션 |
| 브라우저별 Fullscreen/WebAudio 호환성 | Playwright 크로스브라우저 테스트 (Chrome · Edge 필수, Safari best-effort) |
| Supabase Realtime 채널 300개 동시 → 요금·안정성 | 관리자는 폴링, 응시자는 outbound POST만 (Realtime inbound 최소화) |
