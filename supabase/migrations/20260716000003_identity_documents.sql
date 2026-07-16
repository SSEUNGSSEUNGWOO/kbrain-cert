-- 응시자 신분증 이미지 업로드용 Storage bucket
-- 개인정보 · private · 10MB 제한 · 관리자 사후 검토

insert into storage.buckets (id, name, public, file_size_limit)
values ('identity-documents', 'identity-documents', false, 10485760)  -- 10MB
on conflict (id) do nothing;

-- exam_sessions.identity_image_url, identity_review_status는 initial_schema에 이미 존재
