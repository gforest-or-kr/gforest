-- gforest-web 시드: 게시판 38개(공개 8 + 회원 23 + 제한 7) (권한 매트릭스 2026-06-11 검증 결과 기반)
-- read_roles null = 익명 포함 공개 읽기. admin은 함수에서 항상 허용되므로 배열에 불포함.
-- 주의: 운영위/교사/학생 그룹의 정확한 경계는 XE 관리자 확인(GFM-9) 후 조정.

-- 공개 게시판 (익명 읽기 / 회원 쓰기) — 8개
insert into public.boards (slug, name, menu_group, sort_order, board_type, read_roles, write_roles, legacy_mid) values
  ('qna',        '신편입학 Q&A',       '학교소개', 10, 'list',     null, '{member,operator,teacher,student}', 'board_QNA'),
  ('notice',     '알려드립니다',       '학교소식', 10, 'list',     null, '{member,operator,teacher,student}', 'board_noti'),
  ('calendar',   '학교일정표',         '학교소식', 20, 'calendar', null, '{member,operator,teacher,student}', 'board_cal'),
  ('story',      '학교이야기',         '학교소식', 30, 'list',     null, '{member,operator,teacher,student}', 'board_story'),
  ('exchange',   '교류게시판',         '학교소식', 40, 'list',     null, '{member,operator,teacher,student}', 'board_chg'),
  ('info',       '정보·강좌·좋은글',   '학교소식', 50, 'list',     null, '{member,operator,teacher,student}', 'board_info'),
  ('edu-data',   '교육자료실',         '학교소식', 60, 'list',     null, '{member,operator,teacher,student}', 'board_eduData1'),
  ('budget',     '살림살이',           '학교소식', 70, 'list',     null, '{member,operator,teacher,student}', 'board_budset');

-- 회원 게시판 (일반회원 이상 읽기/쓰기) — 23개
insert into public.boards (slug, name, menu_group, sort_order, board_type, read_roles, write_roles, legacy_mid) values
  ('free',         '자유게시판',         '커뮤니티', 10, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_free'),
  ('club',         '동호회',             '커뮤니티', 20, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_circle'),
  ('market',       '벼룩시장·부동산',    '커뮤니티', 30, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_market'),
  ('library',      '도서관',             '커뮤니티', 40, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_lib'),
  ('after-care',   '방과후 돌봄수업',    '커뮤니티', 50, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_after'),
  ('after-music',  '방과후 악기수업',    '커뮤니티', 51, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_Instruments'),
  ('orchestra',    '푸른숲오케스트라',   '커뮤니티', 52, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_Orche'),
  ('after-middle', '중학년 방과후',      '커뮤니티', 53, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_Xuvv80'),
  ('album',        '푸른숲사진첩',       '커뮤니티', 60, 'gallery',     '{member,operator,teacher}', '{member,operator,teacher}', 'board_album2'),
  ('links',        '발도르프관련사이트', '커뮤니티', 70, 'list',        '{member,operator,teacher}', '{member,operator,teacher}', 'board_XoXa54'),
  ('parents',      '학부모게시판',       '학부모학생', 10, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_parent'),
  ('parents-data', '학부모자료실',       '학부모학생', 20, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_Pdata'),
  ('parents-edu',  '학부모 교육 자료모음','학부모학생', 30, 'list',     '{member,operator,teacher}', '{member,operator,teacher}', 'board_edudata'),
  ('career',       '진로탐색자료실',     '학부모학생', 40, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_jinro'),
  ('minutes',      '회의록',             '학부모학생', 50, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_rec'),
  ('parents-assoc','학부모회',           '운영위교사', 30, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_kPes34'),
  ('to-operators', '운영위에게',         '운영위교사', 40, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_toOp1'),
  ('to-parents',   '학부모회에게',       '운영위교사', 41, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_Mcow16'),
  ('approval',     '품의서',             '운영위교사', 50, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_pum'),
  ('reservation',  '공간사용예약',       '운영위교사', 60, 'reservation','{member,operator,teacher}', '{member,operator,teacher}', 'board_rsv'),
  ('level-up',     '등업게시판(아카이브)','운영위교사', 70, 'list',     '{member,operator,teacher}', '{member,operator,teacher}', 'board_grade'),
  ('feedback',     '홈피제안·오류신고',  '운영위교사', 80, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'board_bug'),
  ('yeoreum',      '열음자리 뚝딱이',    '운영위교사', 90, 'list',      '{member,operator,teacher}', '{member,operator,teacher}', 'new_build');

-- 제한 게시판 — 7개 (hot_2024 통합뷰는 신규 미이관, 최신글 피드로 대체 검토)
insert into public.boards (slug, name, menu_group, sort_order, board_type, read_roles, write_roles, legacy_mid) values
  ('students',      '학생게시판',     '학부모학생', 60, 'list', '{student}',  '{student}',  'board_std'),
  ('operators',     '운영위원회',     '운영위교사', 10, 'list', '{operator}', '{operator}', 'board_op1'),
  ('teachers',      '교사회',         '운영위교사', 20, 'list', '{teacher}',  '{teacher}',  'board_teacher1'),
  ('teachers-room', '너른방',         '운영위교사', 21, 'list', '{teacher}',  '{teacher}',  'board_Tnurun1'),
  ('teachers-minutes','교사회 회의록','운영위교사', 22, 'list', '{teacher}',  '{teacher}',  'board_Trec1'),
  ('teachers-agenda','안건방',        '운영위교사', 23, 'list', '{teacher}',  '{teacher}',  'board_LCwm52'),
  ('teachers-data', '교사회자료실',   '운영위교사', 24, 'list', '{teacher}',  '{teacher}',  'board_Tdata');

-- 예약 공간 (board_rsv 기존 글에서 실사용 공간 확인 후 조정)
insert into public.spaces (name, color, sort_order) values
  ('강당',   '#2f9e6e', 10),
  ('음악실', '#0ea5e9', 20),
  ('도서관', '#f59e0b', 30),
  ('운동장', '#fb7185', 40);

-- 정적 페이지 13개 (콘텐츠는 ETL에서 채움)
insert into public.static_pages (slug, title, menu_group, sort_order) values
  ('about',        '교육이념 및 학교·교사소개', '학교소개', 10),
  ('curriculum',   '푸른숲의 흐름',            '학교소개', 20),
  ('waldorf',      '발도르프 교육이란?',        '학교소개', 21),
  ('inclusive',    '통합교육이란?',             '학교소개', 22),
  ('class-lower',  '담임과정',                  '학교소개', 23),
  ('class-upper',  '상급과정',                  '학교소개', 24),
  ('timetable',    '시간표',                    '학교소개', 25),
  ('after-school', '방과후활동',                '학교소개', 26),
  ('faq',          'FAQ',                       '학교소개', 27),
  ('organization', '조직 및 운영',              '학교소개', 30),
  ('history',      'History',                   '학교소개', 40),
  ('admission',    '신편입학',                  '학교소개', 50),
  ('location',     '오시는길',                  '학교소개', 60);
