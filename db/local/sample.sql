-- 로컬 개발용 샘플 데이터 (db/bootstrap.sh local 이 시드 다음에 적용). dev/prod 에는 절대 넣지 않는다.
-- 테스트 계정 (비밀번호 모두 DevTest!2026):
--   admin.test@gforest.kr    admin
--   operator.test@gforest.kr operator
--   member.test@gforest.kr   member
--   pending.test@gforest.kr  pending (승인 대기 화면 확인용)
-- 재실행해도 안전(on conflict do nothing / 고정 uuid).

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'admin.test@gforest.kr',    '$2b$10$k4SGq37BCJI86a9/OHjJD.WyNVHZjAAZoQqvuj.Bffs9b1SZie8ii', now(), '{"nickname":"관리자","name":"테스트 관리자"}'),
  ('00000000-0000-4000-8000-000000000002', 'operator.test@gforest.kr', '$2b$10$k4SGq37BCJI86a9/OHjJD.WyNVHZjAAZoQqvuj.Bffs9b1SZie8ii', now(), '{"nickname":"운영위원","name":"테스트 운영위원"}'),
  ('00000000-0000-4000-8000-000000000003', 'member.test@gforest.kr',   '$2b$10$k4SGq37BCJI86a9/OHjJD.WyNVHZjAAZoQqvuj.Bffs9b1SZie8ii', now(), '{"nickname":"조합원","name":"테스트 조합원"}'),
  ('00000000-0000-4000-8000-000000000004', 'pending.test@gforest.kr',  '$2b$10$k4SGq37BCJI86a9/OHjJD.WyNVHZjAAZoQqvuj.Bffs9b1SZie8ii', now(), '{"nickname":"신규가입","name":"테스트 대기자"}')
on conflict (id) do nothing;

-- 역할 부여. 가드 트리거(admin 만 변경 가능)는 부트스트랩 중이라 잠시 끈다.
alter table public.profiles disable trigger trg_profiles_guard_role;
update public.profiles set role = 'admin'    where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set role = 'operator' where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set role = 'member'   where id = '00000000-0000-4000-8000-000000000003';
alter table public.profiles enable trigger trg_profiles_guard_role;

-- 글 몇 개: 공개 게시판(notice, story)과 회원 게시판(free)
insert into public.posts (id, board_id, author_id, title, content, is_notice) values
  ('00000000-0000-4000-8000-00000000a001', (select id from boards where slug='notice'), '00000000-0000-4000-8000-000000000002', '[샘플] 2학기 학부모 총회 안내', '9월 셋째 주 토요일 오전 10시, 강당에서 총회를 엽니다.', true),
  ('00000000-0000-4000-8000-00000000a002', (select id from boards where slug='notice'), '00000000-0000-4000-8000-000000000002', '[샘플] 급식 도우미 모집', '이번 달 급식 도우미를 모집합니다. 댓글로 신청해 주세요.', false),
  ('00000000-0000-4000-8000-00000000a003', (select id from boards where slug='story'),  '00000000-0000-4000-8000-000000000003', '[샘플] 가을 소풍 이야기', '아이들과 함께한 가을 소풍 후기입니다.', false),
  ('00000000-0000-4000-8000-00000000a004', (select id from boards where slug='free'),   '00000000-0000-4000-8000-000000000003', '[샘플] 회원 전용 글 — 로그인해야 보입니다', '자유게시판 샘플 글입니다.', false)
on conflict (id) do nothing;

insert into public.comments (id, post_id, author_id, content) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-000000000003', '신청합니다!'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000a004', '00000000-0000-4000-8000-000000000001', '관리자 댓글 샘플')
on conflict (id) do nothing;
