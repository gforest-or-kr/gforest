# DB 스키마 설계 v1 (2026-06-11)

> 근거: 게시판 권한 매트릭스(4단계+ 역할), 화면설계서 v1.1, 마이그레이션 계획서 운영 원칙.
> SQL 원본: `db/migrations/00000000000001_initial_schema.sql`(+ 이후 번호) + `db/seed.sql` (게시판 38개 시드). 적용은 `db/bootstrap.sh <env>` (`db/README.md`).
> 원칙: 표준 Postgres 중심(`pg_dump` 탈출 가능), 게시판·권한은 **데이터로 관리** — 게시판 추가/권한 변경에 코드 수정 불필요.

## 1. ERD 개요

```
auth.users (RDS 부트스트랩 테이블, Auth.js 사용 — db/bootstrap_rds.sql)
   │ 1:1 (가입 트리거 자동 생성)
profiles ─── role: pending|member|operator|teacher|student|admin
   │ 1:N                              role_audit (역할 변경 감사)
   ├──────────────┐
posts ◄─── boards (slug, menu_group, board_type, read_roles[], write_roles[])
   │ │             └─ board_type: list | gallery | calendar | reservation
   │ ├─ event_date/start/end, space_id ──► spaces (예약 공간, 시간중복 EXCLUDE 제약)
   │ ├─ 1:N comments (parent_id 1단계 대댓글)
   │ └─ 1:N attachments (Storage 경로)
   │
사이트 콘텐츠: popups / slides / static_pages   (SCR-601/602/604, admin 전용 쓰기)
```

## 2. 핵심 설계 결정

| 결정 | 내용 | 이유 |
|---|---|---|
| 역할 = enum 6종 | `pending → member / operator / teacher / student / admin` | 기존 등업 체계 계승. 익명은 행 없음(비로그인). 신규 가입 = `pending`(공개 열람만) → 관리자 승인 시 `member` |
| 게시판 권한 = 역할 배열 | `boards.read_roles[]` / `write_roles[]`. **null = 공개(익명 읽기)** | 권한이 선형 계층이 아님(운영위/교사/학생이 병렬). 배열이 매트릭스를 그대로 표현. admin은 함수에서 항상 통과 |
| RLS가 단일 진실 | `can_read_board()` / `can_write_board()` security definer 함수를 posts·comments·attachments 정책이 공유 | "본인 글만 수정", "권한 게시판 차단"을 DB에서 강제 — 앱 버그가 데이터 유출로 이어지지 않음 |
| 게시판 38개 = 시드 데이터 | seed.sql에 권한 매트릭스 그대로 입력, `legacy_mid` 보존 | 검증된 매트릭스의 1:1 이전 + ETL 멱등성 |
| 일정·예약 = posts 확장 | `event_date/start/end`, `space_id` 컬럼. 별도 테이블 없음 | 캘린더·예약도 "게시글"인 기존 모델 유지(이관 단순). 예약 중복은 `EXCLUDE USING gist` 제약으로 DB에서 차단 |
| soft delete | `deleted_at` (posts/comments) | 운영 실수 복구. RLS select에서 자동 제외 |
| 역할 변경 보호 | 트리거로 본인 role 변경 차단 + `role_audit` 자동 기록 | profiles update 정책을 단순하게 유지하면서 권한 상승 방지 |
| 조회수 RPC | `increment_view_count()` security definer | 익명도 조회수 증가 가능하되 임의 update 차단 |

## 3. 테이블 요약

| 테이블 | 용도 | 비고 |
|---|---|---|
| profiles | 회원 (auth.users 1:1) | nickname unique, `legacy_member_srl` |
| role_audit | 역할 변경 이력 | admin만 열람 |
| boards | 게시판 38개 | `legacy_mid`, SCR-603에서 CRUD |
| spaces | 예약 공간 | 강당/음악실/도서관/운동장 (시드, 확인 후 조정) |
| posts | 게시글 + 일정/예약 확장 | `legacy_document_srl`, soft delete, 시간중복 제약 |
| comments | 댓글 (1단계 대댓글) | `legacy_comment_srl` |
| attachments | 첨부 메타 (Storage 경로) | `legacy_file_srl` |
| popups / slides / static_pages | 메인 팝업·슬라이더·정적 13페이지 | admin 쓰기, 공개 읽기 |

## 4. RLS 정책 요약

| 대상 | select | insert | update/delete |
|---|---|---|---|
| posts | 게시판 read_roles 충족(공개=전체) & not deleted | write_roles 충족 & 본인 명의 | 본인 또는 admin (hard delete는 admin만) |
| comments | 소속 게시글 읽기 가능자 | 로그인(`pending` 제외) & 게시글 읽기 가능 | 본인 또는 admin |
| attachments | 소속 게시글 따라감 | 본인 게시글에만 | 본인 또는 admin |
| profiles | 공개(작성자 표시) | 본인 | 본인(role 제외)/admin |
| boards·spaces·popups·slides·static_pages | 공개 | admin | admin |

**Storage 정책(마이그레이션 별도)**: `attachments` 버킷 private + 다운로드는 `attachments` 테이블 RLS를 통과한 경우 서명 URL 발급(서버 액션). 공개 게시판 이미지는 `public-images` 버킷(공개) 분리 — egress 절약을 위해 캐시 헤더 설정.

## 5. XE → 신규 매핑 (ETL 키)

| XE | 신규 | 매핑 키 |
|---|---|---|
| xe_member | auth.users + profiles | `profiles.legacy_member_srl` |
| xe_member_group | profiles.role | 그룹명→enum 변환표 (관리자 확인 후 확정) |
| 게시판 모듈(mid) | boards | `boards.legacy_mid` |
| xe_documents | posts | `posts.legacy_document_srl` |
| xe_comments | comments(parent_srl→parent_id) | `comments.legacy_comment_srl` |
| xe_files | Storage 업로드 + attachments | `attachments.legacy_file_srl` |

모든 legacy 컬럼은 `unique` — ETL 재실행 시 upsert 기준(멱등).

## 6. 미결/후속

1. **그룹↔역할 변환표**: XE 관리자(GFM-9)에서 실제 그룹 목록 확인 후 확정 (현재 시드의 운영위/교사/학생 경계는 추정)
2. **학생 역할의 회원 게시판 접근 범위**: 시드는 미포함 — 관리자 확인 후 read_roles에 추가 여부 결정
3. FTS(통합검색): `pg_trgm` 기반 검색 인덱스는 P1에서 별도 마이그레이션
4. 등업게시판: 신규에서는 가입 승인 플로우로 대체, 게시판은 아카이브로 이관
5. Storage 버킷 정책: 스캐폴드 단계에서 별도 마이그레이션으로 추가
