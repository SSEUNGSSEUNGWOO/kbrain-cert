# 로그인 인사 로딩 화면 + 계정 관리 페이지 설계

날짜: 2026-08-05
상태: 승인됨

## 배경

- 스태프 로그인 성공 후 `/` 리다이렉트 → 역할별 대시보드 렌더 사이에 로딩 공백이 있다 (버튼의 "로그인 중…"만 표시).
- 토스 앱처럼 개인화된 인사말("장승우 본부장님, 좋은 하루입니다")을 이 구간에 보여준다.
- `profiles` 테이블에 `name`·`position`·`organization` 컬럼은 있으나 데이터를 채울 UI가 없어 계정 관리 페이지를 함께 만든다.

## Part 1 — 로그인 인사 로딩 화면 (스태프 전원)

### `app/login/actions.ts`
- `signIn` 성공 시 `redirect("/")` 제거.
- admin 클라이언트로 `profiles`에서 `name`, `position` 조회 후 `{ success: true, name, position }` 반환.
- `revalidatePath("/", "layout")` 유지.
- 프로필 조회 실패 시에도 로그인은 성공 처리 (name/position null).

### `app/login/page.tsx`
- 성공 응답 수신 시 풀스크린 오버레이 표시 (`take/loading.tsx` 톤: `#FAFAF5` 배경, 네이비 스피너).
- 최소 1.2초 표시 후 `router.push("/")` — 목적지 렌더 완료까지 오버레이 유지.
- 문구: `{이름} {직책}님, {시간대 인사}`
  - 직책 없으면 `{이름}님`, 이름도 없으면 인사말만.
  - 시간대(클라이언트 시각): 05–11시 "좋은 아침입니다" · 11–17시 "좋은 하루입니다" · 17–22시 "오늘도 수고 많으셨습니다" · 22–05시 "늦은 시간까지 고생 많으십니다"
- 부문구: "대시보드를 준비하고 있습니다"
- 로그인 실패 시 기존 에러 표시 유지 (오버레이 없음).

## Part 2 — `/admin/accounts` 계정 관리 페이지 (admin 전용)

범위: 조회 + 프로필 수정 + 계정 생성. (역할 변경·비밀번호 재설정·비활성화는 범위 외)

### `app/admin/accounts/page.tsx` (서버 컴포넌트)
- `auth.admin.listUsers()` + `user_roles` + `profiles`를 admin 클라이언트로 조회·병합.
- 테이블 컬럼: 이메일 · 이름 · 직책 · 소속 · 역할 · 생성일.
- guard는 `app/admin/layout.tsx`의 `requireRole("admin")`이 담당.

### `app/admin/accounts/accounts-table.tsx` (클라이언트)
- 행별 수정 → 이름/직책/소속 인라인 편집 → `PATCH /api/admin/accounts`.

### `app/admin/accounts/create-form.tsx` (클라이언트)
- 이메일 · 비밀번호 · 역할(admin/examiner/grader) · 이름 · 직책 · 소속 입력 → `POST /api/admin/accounts`.

### `app/api/admin/accounts/route.ts`
- 인증 패턴은 `/api/admin/invitations`와 동일: `createServerSupabase()`로 유저 확인 → `user_roles`에서 admin role 확인 → admin 클라이언트로 실행.
- POST: `auth.admin.createUser`(email_confirm: true) + `user_roles` upsert + `profiles` upsert. (scripts/create-admin.mjs 로직의 UI 버전)
- PATCH: `profiles` upsert (name / position / organization).

### `components/admin-shell.tsx`
- `NAV_ITEMS`와 `AdminNavKey`에 "계정 관리"(`accounts`) 추가.

## 검증

- `npm run build` · `npm run lint` 통과.
- 수동: 로그인 → 인사 화면 → 대시보드 전환 확인, 계정 생성/수정 후 Supabase 대시보드에서 profiles·user_roles 반영 확인.
