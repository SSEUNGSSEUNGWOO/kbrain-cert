-- 감독관 액션: 시간 연장 + 채팅 메시지
-- exam_sessions.time_extension_minutes: 감독관이 부여한 추가 시간 (분)
-- session_messages: 감독관 ↔ 응시자 채팅 + 시스템 알림

alter table exam_sessions
  add column if not exists time_extension_minutes int not null default 0;

comment on column exam_sessions.time_extension_minutes is
  '감독관이 이 세션에 부여한 추가 시간(분). 실 종료 시각 = exam_date + duration_minutes + time_extension_minutes';

create table if not exists session_messages (
  id bigserial primary key,
  session_id uuid not null references exam_sessions(id) on delete cascade,
  sender_role text not null check (sender_role in ('applicant', 'examiner', 'system')),
  sender_id uuid,                                          -- examiner일 때 auth.users.id · applicant/system은 null
  content text not null,
  is_announcement boolean not null default false,          -- 전체 공지 (예정 시각) · false=개별 채팅
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_session_messages_session
  on session_messages (session_id, created_at desc);

-- Realtime publication (이미 exam_sessions 등록됨)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'session_messages'
  ) then
    alter publication supabase_realtime add table session_messages;
  end if;
end $$;

-- auto_submit_expired_sessions()의 종료 시각 계산에 time_extension_minutes 반영
create or replace function auto_submit_expired_sessions()
returns void
language plpgsql
security definer
as $$
declare
  submitted_count int;
begin
  with expired as (
    update exam_sessions es
    set status = 'submitted',
        submit_time = now(),
        auto_submitted = true,
        updated_at = now()
    from exams e
    where es.exam_id = e.id
      and es.submit_time is null
      and es.status <> 'submitted'
      and e.exam_date is not null
      and e.exam_date + ((e.duration_minutes + coalesce(es.time_extension_minutes, 0)) || ' minutes')::interval <= now()
    returning es.id
  )
  select count(*) into submitted_count from expired;

  if submitted_count > 0 then
    update answers a
    set submitted_at = now()
    from exam_sessions es
    where a.session_id = es.id
      and a.submitted_at is null
      and es.submit_time is not null;
    raise notice '[auto-submit] % sessions submitted', submitted_count;
  end if;
end;
$$;
