-- kbrain-cert · 초기 스키마 (M1)
-- 결정 반영:
--   - 작업형 전용 (자동채점 컬럼 없음, submission_slots 필수, rubric만 서버 격리)
--   - 감독 유연화: question_sets.proctoring_disabled 최초 포함
--   - 100점 환산: raw 저장, 표시만 변환 (헬퍼 함수 별도)
--   - 카테고리·등급 하드코딩 해제 (설정 테이블)
--   - 인증서 발급 미포함

-- ═════════════════════════════════════════
-- 1. Enums
-- ═════════════════════════════════════════

create type app_role as enum ('admin', 'examiner', 'grader', 'applicant');
create type difficulty_level as enum ('쉬움', '보통', '어려움');
create type exam_status as enum ('draft', 'open', 'closed');
create type session_status as enum ('waiting', 'in_progress', 'submitted', 'passed', 'failed');
create type identity_review_status as enum ('pending', 'approved', 'rejected');
create type invitation_status as enum ('created', 'sent', 'used', 'expired');
create type recording_kind as enum ('webcam', 'screen');
create type event_severity as enum ('info', 'warn', 'high');

-- ═════════════════════════════════════════
-- 2. 사용자 & 역할
-- ═════════════════════════════════════════

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'applicant',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  organization text,
  department text,
  position text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═════════════════════════════════════════
-- 3. 카테고리·등급 (하드코딩 해제)
-- ═════════════════════════════════════════

create table question_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,                  -- hex color · UI 뱃지용
  order_num int not null default 0,
  created_at timestamptz not null default now()
);

create table exam_grades (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  order_num int not null default 0,
  created_at timestamptz not null default now()
);

-- ═════════════════════════════════════════
-- 4. 문제 & 세트 (작업형 전용)
-- ═════════════════════════════════════════

create table question_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scenario text,
  attachments jsonb default '[]'::jsonb,      -- [{ name, url, size }]
  total_score numeric,
  order_num int not null default 0,
  category_id uuid references question_categories(id) on delete set null,
  grade_id uuid references exam_grades(id) on delete set null,
  proctoring_disabled boolean not null default false,   -- ⚠️ 이슈 #1 최초부터
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                            -- 예: T-E-036
  category_id uuid references question_categories(id) on delete set null,
  grade_id uuid references exam_grades(id) on delete set null,
  difficulty difficulty_level,
  tags text[] default '{}',
  content text not null,                                -- Markdown
  attachments jsonb default '[]'::jsonb,                -- 배포 자료 zip 등
  submission_slots jsonb not null,                      -- [{ id, type, label, max_score, accept }]
                                                         -- type ∈ (text, long_text, url, file, number)
  rubric jsonb,                                          -- ⚠️ 서버 전용 · 뷰로 격리
  max_score numeric not null,                            -- 슬롯 합계와 일치 (트리거 검증)
  set_id uuid references question_sets(id) on delete set null,
  set_order int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 문제 변경 이력
create table question_revisions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  reason text
);

-- ═════════════════════════════════════════
-- 5. 시험
-- ═════════════════════════════════════════

create table exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade_id uuid references exam_grades(id) on delete set null,
  exam_date timestamptz,
  duration_minutes int not null default 120,
  max_participants int,
  status exam_status not null default 'draft',
  instructions text,
  registration_mode text not null default 'invite_only'
    check (registration_mode in ('invite_only', 'open', 'hybrid')),
  pass_score int not null default 75,                    -- 100점 환산 기준
  is_test_mode boolean not null default false,
  use_absolute_end boolean not null default false,
  entry_start_minutes int not null default 60,
  allow_dual_monitor boolean not null default false,
  skip_waiting_checks boolean not null default false,
  agora_channel_name text,                               -- 시험별 Agora 채널
  custom_texts jsonb default '{}'::jsonb,
  alert_event_types text[] default '{}',                 -- 감독관 알림 화이트리스트
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exam_sets (
  exam_id uuid not null references exams(id) on delete cascade,
  set_id uuid not null references question_sets(id) on delete restrict,
  order_num int not null default 0,
  primary key (exam_id, set_id)
);

create table exam_questions (
  exam_id uuid not null references exams(id) on delete cascade,
  question_id uuid not null references questions(id) on delete restrict,
  order_num int not null default 0,
  primary key (exam_id, question_id)
);

-- ═════════════════════════════════════════
-- 6. 응시자 초대 & OTP
-- ═════════════════════════════════════════

create table exam_invitations (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  email text not null,
  name text,
  organization text,
  invite_code text not null unique,
  status invitation_status not null default 'created',
  sent_at timestamptz,
  used_at timestamptz,
  allow_dual_monitor boolean,
  allow_no_webcam boolean,
  allow_no_screen_share boolean,
  created_at timestamptz not null default now()
);

create table guest_otp_codes (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references exam_invitations(id) on delete cascade,
  email text not null,
  code text not null,                    -- 6자리
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_guest_otp_email_expires on guest_otp_codes (email, expires_at);

-- ═════════════════════════════════════════
-- 7. 응시 세션 & 답안
-- ═════════════════════════════════════════

create table exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete restrict,
  applicant_id uuid references auth.users(id) on delete set null,
  invitation_id uuid references exam_invitations(id) on delete set null,
  status session_status not null default 'waiting',
  start_time timestamptz,
  submit_time timestamptz,
  score_total numeric,                        -- raw · 표시는 헬퍼로 환산
  is_flagged boolean not null default false,
  identity_image_url text,                    -- Supabase Storage 경로
  identity_review_status identity_review_status default 'pending',
  identity_review_note text,
  identity_reviewed_by uuid references auth.users(id),
  monitoring_notes text,
  auto_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_exam_sessions_exam on exam_sessions (exam_id);
create index idx_exam_sessions_applicant on exam_sessions (applicant_id);

create table answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete restrict,
  slot_values jsonb default '{}'::jsonb,       -- { slot_id: value }
  slot_scores jsonb,                            -- { slot_id: score } · 채점 후
  score numeric,                                -- raw 합계
  feedback text,
  graded_by uuid references auth.users(id),
  graded_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (session_id, question_id)              -- 응시자당 문항별 답안 1개 (idempotency)
);
create index idx_answers_session on answers (session_id);

-- ═════════════════════════════════════════
-- 8. 감독 이벤트 (월 파티셔닝 예정)
-- ═════════════════════════════════════════

create table monitoring_events (
  id bigserial primary key,
  session_id uuid not null references exam_sessions(id) on delete cascade,
  event_type text not null,
  detected_at timestamptz not null default now(),
  screenshot_url text,
  question_index int,
  severity event_severity not null default 'info',
  payload jsonb,
  is_reviewed boolean not null default false,
  reviewer_note text
);
create index idx_monitoring_events_session on monitoring_events (session_id, detected_at);
create index idx_monitoring_events_type on monitoring_events (event_type, detected_at desc);
-- 향후 사용량 증가 시 monthly partitioning 적용 (100명 규모에선 초기엔 불필요)

-- ═════════════════════════════════════════
-- 9. 녹화 청크 (R2 참조만)
-- ═════════════════════════════════════════

create table recording_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  kind recording_kind not null,
  chunk_index int not null,
  object_key text not null,                    -- R2 경로 (예: sessions/{id}/webcam/000123.webm)
  mime_type text,
  size_bytes bigint,
  duration_ms int,
  started_at timestamptz,
  ended_at timestamptz,
  is_header boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, kind, chunk_index)
);
create index idx_recording_chunks_session on recording_chunks (session_id, kind, chunk_index);

-- ═════════════════════════════════════════
-- 10. 사이트 설정
-- ═════════════════════════════════════════

create table site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- 초기 브랜딩·이메일 헤더 seed
insert into site_settings (key, value) values
  ('site_title', 'kbrain-cert'),
  ('site_subtitle', '공식 자격 검정 플랫폼'),
  ('footer_org', 'daeasy'),
  ('email_from_name', 'kbrain-cert'),
  ('email_from_address', 'noreply@daeasy.co.kr'),
  ('email_subject_prefix', '[kbrain-cert] '),
  ('recording_retention_days', '30');

-- ═════════════════════════════════════════
-- 11. ⚠️ 격리 뷰 — 응시자용 questions
-- ═════════════════════════════════════════

-- rubric 컬럼 제외 (자동채점 없으니 정답 컬럼도 없음 · 격리 대상은 rubric만)
create view questions_for_applicant as
  select
    id, code, category_id, grade_id, difficulty, tags,
    content, attachments,
    submission_slots,
    max_score, set_id, set_order,
    created_at
  from questions;

comment on view questions_for_applicant is
  'RLS 우회 방지용 격리 뷰 · applicant role은 이 뷰만 access · rubric 미노출';

-- ═════════════════════════════════════════
-- 12. 점수 환산 함수 (100점 환산 통일)
-- ═════════════════════════════════════════

create or replace function to_percentage(raw numeric, max_val numeric)
returns int
language sql
immutable
as $$
  select case
    when max_val is null or max_val <= 0 then 0
    else round((raw / max_val) * 100)::int
  end;
$$;

comment on function to_percentage is
  '점수 100점 환산 통일 헬퍼 · 표시·판정은 항상 이 함수 통과 · 저장은 raw';

-- ═════════════════════════════════════════
-- 13. 초기 seed - 카테고리·등급
-- ═════════════════════════════════════════

insert into question_categories (name, color, order_num) values
  ('생성형AI 활용', '#4b3fd4', 1),
  ('데이터 분석', '#268a8a', 2),
  ('서비스 구현', '#c26a1a', 3);

insert into exam_grades (name, color, order_num) values
  ('Green', '#2a6f4d', 1),
  ('Blue', '#2f6798', 2),
  ('Black', '#132853', 3),
  ('전문인재', '#a36229', 4);

-- ═════════════════════════════════════════
-- 14. RLS 초안 (개발 단계에서 최소만 · M2에서 강화)
-- ═════════════════════════════════════════

alter table user_roles enable row level security;
alter table profiles enable row level security;
alter table question_categories enable row level security;
alter table exam_grades enable row level security;
alter table question_sets enable row level security;
alter table questions enable row level security;
alter table question_revisions enable row level security;
alter table exams enable row level security;
alter table exam_sets enable row level security;
alter table exam_questions enable row level security;
alter table exam_invitations enable row level security;
alter table guest_otp_codes enable row level security;
alter table exam_sessions enable row level security;
alter table answers enable row level security;
alter table monitoring_events enable row level security;
alter table recording_chunks enable row level security;
alter table site_settings enable row level security;

-- 개발 단계: 인증된 사용자 read-only (M2에서 role별 세분화)
-- Service role은 항상 RLS 우회 → 서버 액션에서 관리자 작업 처리
create policy "authed_read_categories" on question_categories for select to authenticated using (true);
create policy "authed_read_grades" on exam_grades for select to authenticated using (true);
create policy "authed_read_settings" on site_settings for select to authenticated using (true);
create policy "self_read_profile" on profiles for select to authenticated using (id = auth.uid());
create policy "self_update_profile" on profiles for update to authenticated using (id = auth.uid());

-- 시험·문제은행은 M2에서 admin/examiner/grader role 기반으로 정책 추가
-- 응시자용 questions_for_applicant 뷰는 별도 GRANT + RLS 정책

-- ═════════════════════════════════════════
-- 완료 · M2에서 확장:
--   - 역할별 RLS 정책 (admin/examiner/grader/applicant)
--   - questions_for_applicant 뷰 SELECT 권한
--   - monitoring_events 파티셔닝 (사용량 증가 시)
--   - 함수: 슬롯 합계 = max_score 검증 트리거
--   - realtime replication (관리자 대시보드용)
-- ═════════════════════════════════════════
