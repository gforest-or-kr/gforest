-- 댓글 '수정됨' 표시용 edited_at (GFM)
--
-- updated_at은 (1) 트리거 trg_comments_touch가 모든 UPDATE(소프트삭제 포함)에 갱신하고
-- (2) 레거시 XE import가 now()로 채워 created_at과 달라, '본문 수정 여부' 판별에 못 쓴다
-- (레거시 댓글 269건 전부 updated_at > created_at). 그래서 앱 내 본문 수정 시에만 채우는
-- 전용 컬럼 edited_at을 둔다. 기본 null = 미수정 → 레거시·신규 모두 수정 전엔 표시 안 됨.
-- updateComment 액션이 본문 수정 시 edited_at = now()를 함께 기록한다(소프트삭제는 건드리지 않음).

alter table public.comments add column if not exists edited_at timestamptz;
