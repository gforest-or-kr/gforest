---
name: db-migration
description: DB 스키마(테이블·컬럼·인덱스·RLS 정책·함수·트리거)를 바꿀 때의 순서. 게시판 추가·권한 변경은 add-board(데이터). 로컬 검증 → PR → 배포 파이프라인이 dev/prod 에 적용.
---
# DB 스키마 변경

공통 뼈대: `/task GFM-n` → 로컬에서 만들고 검증 → `/pr` → develop 병합 → dev 확인. 규칙의 이유는 `db/README.md`, `docs/conventions/code-patterns.md` §2.

## 순서
1. `db/migrations/<14자리>_<snake_name>.sql` 새 파일. 숫자는 기존 파일보다 크게(`date +%Y%m%d%H%M%S`). 한 파일 = 한 가지 변경 = 한 트랜잭션.
2. `npm run db:up` — 미적용 파일만 로컬 Postgres 에 순서대로 적용된다. 처음부터 다시 보려면 `npm run db:reset`.
3. `lib/db/types.ts` 의 Row 타입을 새 컬럼에 맞춘다. 쿼리·화면을 고친다.
4. 새 테이블이면 같은 파일 안에 `alter table … enable row level security` + `create policy …` 를 기존 `posts` 정책을 본떠 쓴다. `gforest_app` 권한은 기본 권한 설정으로 자동으로 붙는다.
5. `npm run dev` 로 화면 확인 → `npm run check` → `/pr`.
6. develop 병합 → 배포 파이프라인이 **서비스 갱신 전에** `gforest-dev-migrate` 태스크로 이 파일을 dev RDS 에 적용한다. Actions 로그에서 `apply <파일명>` / `migrations: 1 applied` 확인. 실패하면 앱은 이전 버전 그대로다.
7. prod 에는 릴리스(`/release`) 때 같은 단계가 실행된다.

## 하지 말 것
- 이미 적용된 파일 수정(고치려면 새 파일). RDS 콘솔·psql 로 dev/prod 직접 변경.
- 하위 호환 깨기: 컬럼 삭제·이름 변경은 코드가 더는 쓰지 않는 **다음 릴리스**에서. 추가 컬럼은 nullable 또는 default.
- 트랜잭션 안에서 못 도는 문장(`create index concurrently` 등).
- BaaS 전용 객체(`storage.*`, `auth.jwt()`) — 표준 Postgres 만.
- `legacy_*` 컬럼(unique) 삭제·변경 — XE ETL 멱등성의 키.

## 확인
- 로컬: `docker compose exec -T db psql -U gforest_admin -d gforest -c "select * from schema_migrations order by 1"`
- dev: 배포 로그. 실제 데이터를 봐야 하면 skill `dbshell`(인프라 담당).
