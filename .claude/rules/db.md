---
paths:
  - "db/**"
  - "lib/db/**"
---
# DB 규칙 (db/**, lib/db/**) — 이유·상세: `db/README.md`, `docs/conventions/code-patterns.md` §2

- 스키마 변경은 `db/migrations/<14자리>_<snake_name>.sql` **새 파일**로만. 숫자는 기존보다 크게(`date +%Y%m%d%H%M%S`). 한 파일 = 한 변경 = 한 트랜잭션.
- 이미 적용된 마이그레이션 파일은 수정하지 않는다(고치려면 새 파일). dev/prod 를 콘솔·psql 로 직접 바꾸지 않는다 — 적용은 배포 파이프라인의 `gforest-<env>-migrate` 태스크가 한다.
- 하위 호환: 컬럼 추가는 nullable 또는 default, 삭제·이름 변경은 코드가 안 쓰게 된 **다음 릴리스**에서. 트랜잭션 안에서 못 도는 문장(`create index concurrently` 등) 금지.
- 표준 Postgres 만: `storage.*`, `auth.jwt()`, `auth.role()` 금지. RLS 는 `auth.uid()` 만 참조(RDS 에서는 `set_config('app.user_id')` 셔임).
- 새 테이블은 같은 파일에서 `enable row level security` + policy(기존 `posts` 정책을 본뜬다). `gforest_app` 권한은 기본 권한 설정으로 자동.
- **`legacy_*` 컬럼(unique)은 XE ETL 멱등성 키 — 삭제·변경 금지.**
- 게시판 추가·권한 변경은 스키마가 아니라 데이터(`db/seed.sql`·관리자 화면 `/admin/boards`). 시드는 `boards` 가 비어 있을 때만 들어간다. 게시판은 38개.
- 변경 후 `lib/db/types.ts` 의 Row 타입을 손으로 맞춘다. 로컬 적용은 `npm run db:up`(미적용분만), 처음부터는 `npm run db:reset`.
- `db/tools/xe/dump/`(XE 덤프, 개인정보)는 커밋·배포·공유 금지. `db/tools/xe/reset-env.sh` 는 dev 전용, prod 실행 금지.
- 절차 전체는 skill: `db-migration` / `add-board` / `dev-reseed` / `dbshell`.
