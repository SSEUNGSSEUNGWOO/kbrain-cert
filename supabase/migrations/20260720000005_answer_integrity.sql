-- 다중 탭/기기 저장 경합과 다른 시험 문항·슬롯 주입을 DB 트랜잭션에서 차단한다.

create or replace function validate_exam_answers(
  p_exam_id uuid,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answers jsonb := coalesce(p_answers, '[]'::jsonb);
begin
  if jsonb_typeof(v_answers) <> 'array'
     or jsonb_array_length(v_answers) > 500
     or octet_length(v_answers::text) > 1048576 then
    raise exception 'invalid answers';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_answers) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'questionId', '') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or jsonb_typeof(coalesce(item->'slotValues', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'invalid answers';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(v_answers)
  ) <> (
    select count(distinct item->>'questionId')
    from jsonb_array_elements(v_answers) item
  ) then
    raise exception 'duplicate question';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_answers) item
    left join exam_questions eq
      on eq.exam_id = p_exam_id
     and eq.question_id = (item->>'questionId')::uuid
    where eq.question_id is null
  ) then
    raise exception 'question not in exam';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_answers) item
    join questions q on q.id = (item->>'questionId')::uuid
    cross join lateral jsonb_object_keys(
      coalesce(item->'slotValues', '{}'::jsonb)
    ) answer_slot(slot_id)
    where not exists (
      select 1
      from jsonb_array_elements(
        coalesce(q.submission_slots, '[]'::jsonb)
      ) defined_slot
      where defined_slot->>'id' = answer_slot.slot_id
    )
  ) then
    raise exception 'slot not in question';
  end if;
end;
$$;

revoke all on function validate_exam_answers(uuid, jsonb) from public;

create or replace function save_exam_answers(
  p_session_id uuid,
  p_answers jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session exam_sessions%rowtype;
  v_exam exams%rowtype;
  v_now timestamptz := now();
  v_deadline timestamptz;
begin
  select *
    into v_session
    from exam_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'session not found';
  end if;
  if v_session.submit_time is not null or v_session.status = 'submitted' then
    raise exception 'already submitted';
  end if;

  select *
    into v_exam
    from exams
   where id = v_session.exam_id;

  v_deadline :=
    coalesce(v_exam.exam_date, v_session.start_time)
    + ((v_exam.duration_minutes + coalesce(v_session.time_extension_minutes, 0))
      || ' minutes')::interval;
  if v_deadline is not null and v_now >= v_deadline then
    raise exception 'exam time expired';
  end if;

  perform validate_exam_answers(v_session.exam_id, p_answers);

  insert into answers (session_id, question_id, slot_values, updated_at)
  select
    p_session_id,
    (item->>'questionId')::uuid,
    coalesce(item->'slotValues', '{}'::jsonb),
    v_now
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item
  on conflict (session_id, question_id)
  do update set
    slot_values = excluded.slot_values,
    updated_at = excluded.updated_at;

  update exam_sessions
     set status = 'in_progress',
         start_time = coalesce(start_time, v_now),
         updated_at = v_now
   where id = p_session_id
     and status = 'waiting';

  return v_now;
end;
$$;

revoke all on function save_exam_answers(uuid, jsonb) from public;
grant execute on function save_exam_answers(uuid, jsonb) to service_role;

create or replace function submit_exam_session(
  p_session_id uuid,
  p_answers jsonb,
  p_auto boolean default false
)
returns table (
  submitted_at timestamptz,
  already_submitted boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_session exam_sessions%rowtype;
  v_exam exams%rowtype;
  v_now timestamptz := now();
  v_deadline timestamptz;
begin
  select *
    into v_session
    from exam_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'session not found';
  end if;
  if v_session.submit_time is not null or v_session.status = 'submitted' then
    return query select v_session.submit_time, true;
    return;
  end if;

  select *
    into v_exam
    from exams
   where id = v_session.exam_id;

  v_deadline :=
    coalesce(v_exam.exam_date, v_session.start_time)
    + ((v_exam.duration_minutes + coalesce(v_session.time_extension_minutes, 0))
      || ' minutes')::interval;
  if v_deadline is not null and v_now > v_deadline + interval '5 seconds' then
    raise exception 'exam time expired';
  end if;

  perform validate_exam_answers(v_session.exam_id, p_answers);

  insert into answers (
    session_id, question_id, slot_values, submitted_at, updated_at
  )
  select
    p_session_id,
    (item->>'questionId')::uuid,
    coalesce(item->'slotValues', '{}'::jsonb),
    v_now,
    v_now
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item
  on conflict (session_id, question_id)
  do update set
    slot_values = excluded.slot_values,
    submitted_at = excluded.submitted_at,
    updated_at = excluded.updated_at;

  update answers
     set submitted_at = v_now
   where session_id = p_session_id
     and submitted_at is null;

  update exam_sessions
     set status = 'submitted',
         submit_time = v_now,
         auto_submitted = p_auto,
         updated_at = v_now
   where id = p_session_id;

  return query select v_now, false;
end;
$$;

revoke all on function submit_exam_session(uuid, jsonb, boolean) from public;
grant execute on function submit_exam_session(uuid, jsonb, boolean) to service_role;

create table if not exists exam_entry_attempts (
  attempt_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1,
  constraint exam_entry_attempts_positive check (attempts > 0)
);

alter table exam_entry_attempts enable row level security;

create or replace function consume_exam_entry_attempt(
  p_attempt_key text,
  p_max_attempts integer default 10,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  if length(p_attempt_key) <> 64
     or p_max_attempts < 1
     or p_window_seconds < 1 then
    raise exception 'invalid rate limit input';
  end if;

  insert into exam_entry_attempts (
    attempt_key, window_started_at, attempts
  )
  values (p_attempt_key, now(), 1)
  on conflict (attempt_key)
  do update set
    window_started_at = case
      when exam_entry_attempts.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then now()
      else exam_entry_attempts.window_started_at
    end,
    attempts = case
      when exam_entry_attempts.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then 1
      else exam_entry_attempts.attempts + 1
    end
  returning attempts into v_attempts;

  return v_attempts <= p_max_attempts;
end;
$$;

revoke all on table exam_entry_attempts from public;
revoke all on function consume_exam_entry_attempt(text, integer, integer)
  from public;
grant execute on function consume_exam_entry_attempt(text, integer, integer)
  to service_role;
