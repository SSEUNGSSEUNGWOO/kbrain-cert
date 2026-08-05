-- 감독관 확인(ack) 처리
-- 확인 시각 이전의 high 이벤트는 monitor의 "주목 필요" 판정에서 제외한다.
-- 확인 시 is_flagged 도 해제 · 이후 새 이탈/부정 이벤트가 오면
-- auto_flag_session_on_events 트리거가 다시 flag 를 세워 재상승한다.
alter table exam_sessions add column if not exists monitor_acked_at timestamptz;
