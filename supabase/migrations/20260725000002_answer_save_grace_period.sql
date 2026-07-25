-- 답안 자동저장 마감 grace period 30초 부여
-- 마감 임박에 저장 요청 → RPC 도착 시 이미 마감 지난 경우가 있음 → 답안 유실 방지
-- 30초 이내면 저장 허용 · 그 후는 exam time expired 유지

create or replace function save_exam_answers(
  p_session_id uuid,
  p_answers jsonb
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session exam_sessions%rowtype;
  v_exam exams%rowtype;
  v_now timestamptz := now();
  v_deadline timestamptz;
  v_grace interval := interval '30 seconds';
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
  -- grace period 30초: 마감 후 30초 이내 저장 요청은 허용 (자동저장 지연 대비)
  if v_deadline is not null and v_now >= (v_deadline + v_grace) then
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

  return v_now;
end;
$$;
