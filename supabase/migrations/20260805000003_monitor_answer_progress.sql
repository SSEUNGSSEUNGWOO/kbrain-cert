-- 감독관 모니터 세트별 작성현황 집계
-- 원본 답안은 내려보내지 않고 세션별·세트별 "작성된 문항 수"만 반환한다.
-- 작성 판정: slot_values 중 비어있지 않은 값(null·빈 문자열·빈 배열/객체 제외)이 하나라도 있는 문항
create or replace function monitor_answer_progress(p_exam_id uuid)
returns table (session_id uuid, set_id uuid, answered integer)
language sql
security definer
set search_path = public
as $$
  select a.session_id, q.set_id, count(*)::integer as answered
  from answers a
  join questions q on q.id = a.question_id
  where a.session_id in (
      select s.id from exam_sessions s
      where s.exam_id = p_exam_id and s.submit_time is null
    )
    and q.set_id is not null
    and exists (
      select 1 from jsonb_each(a.slot_values) kv
      where kv.value <> 'null'::jsonb
        and not (jsonb_typeof(kv.value) = 'string' and btrim(kv.value #>> '{}') = '')
        and kv.value::text not in ('[]', '{}')
    )
  group by a.session_id, q.set_id;
$$;
