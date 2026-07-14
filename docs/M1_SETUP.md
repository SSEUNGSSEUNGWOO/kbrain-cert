# M1 세팅 가이드 — 승우님 실제 액션

**진행 순서**: Supabase 계정 → 프로젝트 2개 생성 (dev/prod) → 스키마 적용 → 환경변수 설정 → 로컬 접속 확인

---

## 1. Supabase 계정 · 프로젝트 생성

### 1.1 계정
- https://supabase.com/dashboard 회원가입 (GitHub OAuth 편함)
- 조직(Organization) 생성 · 이름: `daeasy` (or 승우님 지정)

### 1.2 프로젝트 2개 생성

**dev 프로젝트** (개발용):
- 이름: `kbrain-cert-dev`
- Region: **Northeast Asia (Seoul)**
- Password: 강한 비밀번호 (1Password 등에 저장)
- Plan: **Free** (개발 단계에선 무료 · 프로덕션 진입 시 Pro 업그레이드)

**prod 프로젝트** (프로덕션 · 실제 시험 배포용):
- 이름: `kbrain-cert-prod`
- Region: Seoul
- Password: 별도 강한 비밀번호
- Plan: **Pro** (M5 부하 검증 시점에 업그레이드해도 됨)

### 1.3 API 키 복사 (dev 먼저)

각 프로젝트 → 좌측 하단 **Settings** → **API**:
- **Project URL** (예: `https://abcxyz.supabase.co`)
- **anon public** 키 (긴 문자열 · 클라이언트 노출 OK)
- **service_role secret** 키 (긴 문자열 · **절대 클라이언트 노출 X · 서버 전용**)

---

## 2. 환경변수 설정 (dev 먼저)

프로젝트 루트에 **`.env.local`** 파일 생성 (git ignore됨):

```bash
# Supabase (dev)
NEXT_PUBLIC_SUPABASE_URL=https://<복사한-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<복사한-anon-키>
SUPABASE_SERVICE_ROLE_KEY=<복사한-service-role-키>

# Agora (이미 발급 완료 · M4에서 사용)
NEXT_PUBLIC_AGORA_APP_ID=159975072afc407d90c9b07031f5acb9
AGORA_APP_CERTIFICATE=<Agora Console에서 발급>

# 나머지 (M3~M4 진입 시 채움)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=kbrain-cert-recordings
R2_PUBLIC_BASE_URL=

RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@daeasy.co.kr

NEXT_PUBLIC_APP_URL=http://localhost:3000
OTP_SECRET=<openssl rand -hex 32로 생성>
```

**`.env.local`은 `.gitignore`에 이미 포함**되어 있어서 커밋되지 않음.

---

## 3. 스키마 적용 (SQL Editor로)

### 3.1 dev 프로젝트에 먼저

1. Supabase 대시보드 → **kbrain-cert-dev** 프로젝트 → 좌측 **SQL Editor**
2. `supabase/migrations/20260714000001_initial_schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기 → **Run** 클릭
4. 완료되면 좌측 **Table Editor**에서 테이블 15개 생성 확인:
   - user_roles, profiles
   - question_categories, exam_grades (seed 데이터 포함)
   - question_sets, questions, question_revisions
   - exams, exam_sets, exam_questions
   - exam_invitations, guest_otp_codes
   - exam_sessions, answers
   - monitoring_events, recording_chunks
   - site_settings (seed 데이터 포함)

### 3.2 prod 프로젝트는 나중에

M5 부하검증 통과 후 prod 프로젝트에도 동일 SQL 적용.

---

## 4. 로컬 접속 확인

```bash
cd C:\Dev\kbrain\kbrain-cert
npm run dev
```

브라우저에서 http://localhost:3000 접속 · 화면 정상 렌더링 확인.

이 시점에서는 아직 Supabase 데이터를 실제로 쓰지 않음 (모든 mock 데이터). M2에서 mock을 Supabase 실 데이터로 교체.

---

## 5. 다음 단계 (M2 진입)

M2 스코프 (Supabase 실 데이터 연결):
1. 관리자 페이지들의 mock 데이터를 Supabase 쿼리로 교체
2. `/admin/questions` 문제 CRUD 실동작
3. `/admin/exams` 시험 CRUD 실동작
4. Auth 세팅 (이메일·비밀번호 + Google OAuth)
5. 관리자 역할 부여 (`user_roles` 첫 admin 지정)

---

## 6. 문제 발생 시 체크리스트

- **SQL 실행 에러**: 순서대로 실행됐는지 (Enums → 테이블 → 인덱스 → 뷰 → 함수 → seed → RLS)
- **환경변수 미인식**: `.env.local` 파일이 프로젝트 루트에 있고, dev 서버 재시작
- **`auth.users` 참조 실패**: Supabase는 `auth.users`를 항상 제공하므로 정상. Free tier에서도 유효
- **Supabase Free tier 한계**: DB 500MB · Storage 1GB · Realtime 200 · Auth 50K MAU. 개발엔 충분

---

## 참고 · CAPACITY.md의 미결정 항목

이 M1_SETUP과 함께 결정 필요:

1. ✅ Agora — App ID 발급 완료 (Certificate 발급 필요)
2. **Cloudflare R2** — 계정 명의 (개인/daeasy) · M4 진입 시 활성화
3. **Resend** — 도메인 인증 (daeasy.co.kr) · M3 진입 시
4. face-api.js 모델 · M4 진입 시
5. 응시 녹화 보관 기간 · site_settings의 `recording_retention_days`에 이미 30일 seed (변경 시 수정)
