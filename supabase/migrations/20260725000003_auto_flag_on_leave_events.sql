-- 응시자 이탈 이벤트 자동 flag
-- - page_unloaded (severity=high) 1회 발생 시 즉시 is_flagged=true
-- - tab_hidden (severity=warn) 5회 이상 시 flag
-- - network_offline (severity=high) 1회 발생 시 flag
-- - 기타 severity=high 이벤트 3회 이상 시 flag
-- 감독관 monitor UI 에서 alerts 그룹으로 자동 분류됨

create or replace function auto_flag_session_on_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_high_count int;
  v_tab_hidden_count int;
begin
  -- 세션이 이미 flagged 면 skip
  if exists (select 1 from exam_sessions where id = new.session_id and is_flagged = true) then
    return new;
  end if;

  -- 이탈 신호: page_unloaded, network_offline (즉시 flag)
  if new.event_type in ('page_unloaded', 'network_offline') then
    update exam_sessions
       set is_flagged = true, updated_at = now()
     where id = new.session_id;
    return new;
  end if;

  -- tab_hidden 반복 (5회 이상 flag)
  if new.event_type = 'tab_hidden' then
    select count(*) into v_tab_hidden_count
      from monitoring_events
     where session_id = new.session_id
       and event_type = 'tab_hidden';
    if v_tab_hidden_count >= 5 then
      update exam_sessions
         set is_flagged = true, updated_at = now()
       where id = new.session_id;
    end if;
    return new;
  end if;

  -- 기타 high 이벤트 3회 이상 시 flag
  if new.severity = 'high' then
    select count(*) into v_high_count
      from monitoring_events
     where session_id = new.session_id
       and severity = 'high';
    if v_high_count >= 3 then
      update exam_sessions
         set is_flagged = true, updated_at = now()
       where id = new.session_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_flag_session on monitoring_events;
create trigger trg_auto_flag_session
after insert on monitoring_events
for each row execute function auto_flag_session_on_events();

-- 확인: select id, is_flagged from exam_sessions where is_flagged = true;
