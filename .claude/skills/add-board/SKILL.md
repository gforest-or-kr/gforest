---
name: add-board
description: 게시판을 추가하거나 이름·메뉴 위치·읽기/쓰기 역할·유형(list/gallery/calendar/reservation)을 바꿀 때. 코드가 아니라 boards 데이터로 해결한다.
---
# 게시판 추가·수정·권한 변경

## 순서
1. **코드가 아니라 데이터다.** 관리자 화면(`/admin/boards`, admin 계정)에서 추가·수정한다. 저장 시 `menu` 태그가 무효화돼 헤더·목록에 즉시 반영된다.
2. 권한 판단은 `boards.read_roles / write_roles` + RLS(`can_read_board`/`can_write_board`)가 한다. 화면 코드에 `if (role === …)` 를 새로 넣지 않는다(있다면 UI 노출용일 뿐).
3. **모든 환경에 같은 초기값이 필요한 게시판**(새로 만드는 환경에서도 있어야 하는 것)은 `db/seed.sql` 에도 넣는다. 시드는 `boards` 가 비어 있을 때만 들어가므로 기존 환경에는 관리자 화면으로 같은 내용을 넣어야 한다. 시드 게시판 수(38, 8+23+7)가 바뀌면 `db/seed.sql` 헤더·`CLAUDE.md`·`docs/design/db_schema.md`·ERD 를 함께 고친다.
4. 통폐합(옛 게시판 글을 다른 게시판으로 옮기기)은 **ETL 매핑**(`db/tools/xe/mapping.json`, `boards.legacy_mid`)으로 한다 — 컷오버 전까지는 dev 에 다시 투입(skill `dev-reseed`)하면 반영된다. 컷오버 후에는 `update posts set board_id …` 마이그레이션(skill `db-migration`).

## 하지 말 것
- 게시판마다 페이지·컴포넌트 새로 만들기(템플릿 5종으로 끝나야 한다).
- 권한 분기 중복 구현.

## 확인
비로그인·member·operator 계정으로 각각 목록이 보이는지/안 보이는지. 테스트 계정은 `db/local/sample.sql`(로컬·dev 공통, `*.test@gforest.kr` / `DevTest!2026`).
