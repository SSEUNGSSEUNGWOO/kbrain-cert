# M2 — 첫 admin 계정 지정 (Bootstrap)

**목적**: `/admin/*` 페이지 접근에 필요한 첫 admin user를 생성하고 `user_roles`에 `admin` role을 부여.

---

## 순서

### 1. 승우님 계정 생성 (Supabase Auth)

Supabase 대시보드 → **kbrain-cert-dev** 프로젝트 → 좌측 **Authentication** → **Users** → **Add user** → **Create new user**

- Email: 승우님 실제 이메일 (예: `sseung@kbrainc.com`)
- Password: 강한 비밀번호 · **이번엔 채팅에 붙이지 마세요 · 승우님만 알기**
- **Auto Confirm User**: ✅ 체크 (이메일 인증 skip)
- Create user

### 2. user_id 복사

Authentication → Users → 방금 만든 사용자 클릭 → **User UID** 복사 (UUID 형태 · 예: `abc123-...`)

### 3. user_roles에 admin 부여

Supabase 대시보드 → **SQL Editor** → 아래 SQL 실행 (`<USER_UID>` 부분에 복사한 UID 붙여넣기):

```sql
insert into user_roles (user_id, role)
values ('<USER_UID>', 'admin');

-- 프로필도 함께 생성 (선택)
insert into profiles (id, email, name, organization)
values (
  '<USER_UID>',
  'sseung@kbrainc.com',
  '오지은',
  'daeasy'
)
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  organization = excluded.organization,
  updated_at = now();
```

Run.

### 4. 로그인 테스트

브라우저 → **http://localhost:3000/login** → 이메일 · 비밀번호 입력 → Sign in

성공하면 홈 페이지(`/`)로 리다이렉트 · 상단바에 승우님 이메일 표시. `/admin/questions` · `/admin/exams` 등 접근 가능.

실패 케이스:
- **"Invalid login credentials"**: 이메일·비밀번호 오타
- **홈이나 관리자 페이지에서 /login으로 자동 리다이렉트**: user_roles에 admin이 없음 → 3번 SQL 재실행

---

## 이후 사용자 추가

`user_roles.role`은 `app_role` enum: `admin` · `examiner` · `grader` · `applicant`.

- 신규 감독관: `insert into user_roles (user_id, role) values ('<uid>', 'examiner');`
- 신규 채점자: `insert into user_roles (user_id, role) values ('<uid>', 'grader');`
- 응시자는 초대 OTP 흐름 (M3에서 자동 처리 · 수동 부여 불필요)

M2 후반부에 관리자 페이지에서 사용자 role CRUD UI 추가 예정.

---

## 왜 SQL로 직접 하나요?

M2 초기 단계라 사용자 관리 UI(`/admin/users`)가 아직 없습니다. 첫 admin이 있어야 그 UI를 만들고 사용할 수 있는 부트스트랩 상황이라 SQL로 최초 1회 부여.
