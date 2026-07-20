alter table exam_sessions
  add column if not exists is_test_attempt boolean not null default false;

drop index if exists idx_exam_sessions_invitation_unique;

create unique index if not exists idx_exam_sessions_real_invitation_unique
  on exam_sessions (invitation_id)
  where invitation_id is not null and is_test_attempt = false;

create unique index if not exists idx_exam_sessions_active_test_invitation_unique
  on exam_sessions (invitation_id)
  where invitation_id is not null
    and is_test_attempt = true
    and submit_time is null;

comment on column exam_sessions.is_test_attempt is
  'true면 테스트 시험 회차 · 제출 후 새 회차 생성 가능';
