-- kbrain-cert · 응시자 진입 방식 전환 (이메일+OTP → 링크+이름+전화뒷4)
-- 승우님이 2026-07-20 SQL Editor에서 이미 적용 완료. 이 파일은 기록용.
--
-- 변경:
--  - exams.slug : 응시자 공용 링크 URL slug (/exam/{slug}) · unique · nullable
--  - exam_invitations.phone : 전체 전화번호 (매칭은 뒷4자리로 · 관리자는 전체 저장)
--  - exam_invitations.email : not null → nullable (이제 선택)
--  - guest_otp_codes 테이블 제거 (OTP 흐름 삭제)
--  - (exam_id, name, right(digits(phone), 4)) unique index (관리자 등록 시 매칭 충돌 방지)

alter table exams
  add column if not exists slug text;

create unique index if not exists idx_exams_slug
  on exams (slug)
  where slug is not null;

comment on column exams.slug is
  '응시자 공용 링크 slug · /exam/{slug} · null이면 /exam/{uuid} fallback';

alter table exam_invitations
  add column if not exists phone text;

alter table exam_invitations
  alter column email drop not null;

drop table if exists guest_otp_codes;

create unique index if not exists idx_exam_invitations_name_phone_last4
  on exam_invitations (
    exam_id,
    name,
    right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 4)
  );

comment on column exam_invitations.phone is
  '전체 전화번호 (저장) · 응시자 진입 매칭은 뒷4자리(digits만 추출)로 수행';
