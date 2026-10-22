-- 이해관계자 웹 질의서 응답 저장 (Phase 2)
--
-- 익명 응답을 받는다. 응답 1건 = survey_responses 1행(0절 응답자 구분은 메타로 여기에),
-- 질문 1개 = survey_answers 1행(value jsonb = { [itemKey]: 항목값 }).
-- 중복 의심용 해시(솔트 HMAC — 원본 IP·쿠키값은 저장하지 않음)는 survey_response_hashes 로 분리해
-- 설문 종료 후 `drop table` 한 줄로 지울 수 있게 한다.
--
-- 의도적으로 boards/profiles 등 어떤 기존 테이블도 FK 로 참조하지 않는다:
-- db/tools/xe/reset-env.sh 의 `truncate … cascade` 가 이 테이블들을 비우지 못하게 하기 위함.
--
-- 권한: 누구나(익명 포함) insert, select 는 admin 만. update/delete 정책은 두지 않는다(= 거부).
-- 익명은 SELECT 정책을 통과하지 못하므로 앱은 insert 결과를 돌려받는 형태를 쓰지 않고,
-- id 는 앱(클라이언트 제출 id)이 넣는다. 응답자 구분 키는 문항 데이터 파일이 단일 진실이므로
-- CHECK 에 넣지 않는다(문항 변경 = 데이터 파일 수정만).

create table public.survey_responses (
  id               uuid primary key,
  response_no      bigint generated always as identity unique,
  submitted_at     timestamptz not null default now(),
  respondent_roles text[] not null check (cardinality(respondent_roles) between 1 and 12),
  respondent_other text check (respondent_other is null or char_length(respondent_other) <= 200)
);

create table public.survey_response_hashes (
  response_id  uuid primary key references public.survey_responses (id) on delete cascade,
  browser_hash text,
  ip_hash      text
);

create table public.survey_answers (
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 32),
  value       jsonb not null check (jsonb_typeof(value) = 'object' and pg_column_size(value) <= 65536),
  primary key (response_id, question_id)
);

alter table public.survey_responses       enable row level security;
alter table public.survey_response_hashes enable row level security;
alter table public.survey_answers         enable row level security;

create policy survey_responses_insert       on public.survey_responses       for insert with check (true);
create policy survey_responses_select       on public.survey_responses       for select using (public.is_admin());
create policy survey_response_hashes_insert on public.survey_response_hashes for insert with check (true);
create policy survey_response_hashes_select on public.survey_response_hashes for select using (public.is_admin());
create policy survey_answers_insert         on public.survey_answers         for insert with check (true);
create policy survey_answers_select         on public.survey_answers         for select using (public.is_admin());
