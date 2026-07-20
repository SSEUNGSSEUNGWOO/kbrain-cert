-- 최종 답안 저장과 시험 제출을 한 트랜잭션으로 처리한다.
-- 브라우저가 0초에 요청한 경우의 네트워크 지연을 고려해 5초의 전송 유예만 허용한다.
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

  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) > 500 then
    raise exception 'invalid answers';
  end if;

  insert into answers (session_id, question_id, slot_values, submitted_at, updated_at)
  select
    p_session_id,
    (item->>'questionId')::uuid,
    coalesce(item->'slotValues', '{}'::jsonb),
    v_now,
    v_now
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as item
  where item ? 'questionId'
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

-- 브라우저가 0초에 보낸 원자적 제출 요청이 도착할 시간을 동일하게 보장한다.
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
      and e.exam_date
        + ((e.duration_minutes + coalesce(es.time_extension_minutes, 0))
          || ' minutes')::interval
        + interval '5 seconds' <= now()
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
  end if;
end;
$$;
