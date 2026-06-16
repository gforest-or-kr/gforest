-- WYSIWYG 본문 구분 플래그 (GFM-61)
--
-- true  = WYSIWYG 에디터로 작성된 '정화된 HTML' → dangerouslySetInnerHTML로 렌더.
-- false = plain text(기존 textarea 글) → whitespace-pre-wrap로 렌더(이스케이프).
-- 레거시 글(legacy_document_srl 있음)은 별도로 기존 HTML 경로를 그대로 탄다.
-- 저장형 XSS는 저장 시점에 서버 sanitize(허용목록)로 차단하므로, 렌더는 정화된 HTML만 받는다.

alter table public.posts add column if not exists content_html boolean not null default false;
