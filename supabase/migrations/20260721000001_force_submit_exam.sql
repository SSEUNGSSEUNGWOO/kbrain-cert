-- 감독관 전체 시험 종료: 세션·답안·시스템 메시지를 한 트랜잭션으로 확정
create or replace function force_submit_exam_sessions(
  p_exam_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_session_ids uuid[];
begin
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'reason too short';
  end if;

  select coalesce(array_agg(locked.id), '{}'::uuid[])
    into v_session_ids
    from (
      select id
        from exam_sessions
       where exam_id = p_exam_id
         and submit_time is null
         and status in ('waiting', 'in_progress')
       for update
    ) locked;

  if cardinality(v_session_ids) = 0 then
    return 0;
  end if;

  update answers
     set submitted_at = v_now,
         updated_at = v_now
   where session_id = any(v_session_ids)
     and submitted_at is null;

  update exam_sessions
     set status = 'submitted',
         submit_time = v_now,
         auto_submitted = false,
         monitoring_notes = concat_ws(E'\n', monitoring_notes,
           '[force_submit_all] ' || trim(p_reason)),
         updated_at = v_now
   where id = any(v_session_ids);

  insert into session_messages (session_id, sender_role, content)
  select id, 'system',
         '감독관이 전체 시험을 종료했습니다: ' || trim(p_reason)
    from unnest(v_session_ids) id;

  return cardinality(v_session_ids);
end;
$$;

revoke all on function force_submit_exam_sessions(uuid, text) from public;
grant execute on function force_submit_exam_sessions(uuid, text) to service_role;
