-- 설문 구분 키 (GFM-98). 설문이 여러 건이 되므로 응답 행마다 어느 설문인지 적는다.
-- 값 = lib/survey/surveys.ts 의 slug(<연도>-<주제>). 기존 행은 첫 설문(2026-website)으로 채우고 default 는 뗀다
-- — 다음 설문이 키 없이 섞여 들어가지 않게(코드가 항상 넣는다).
alter table public.survey_responses
  add column survey_key text not null default '2026-website'
    check (survey_key ~ '^[a-z0-9][a-z0-9-]{0,63}$');
alter table public.survey_responses alter column survey_key drop default;
