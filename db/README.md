# db/ — 스키마 단일 진실

RDS Postgres 스키마·시드·부트스트랩. **콘솔 수동 변경 금지** — 여기 있는 SQL 만이 진실이다(CLAUDE.md 원칙 2).

| 경로 | 내용 |
|---|---|
| `migrations/*.sql` | 스키마 마이그레이션. 번호 순서대로 1회씩 적용되며 `public.schema_migrations` 에 기록 |
| `seed.sql` | 게시판 38개 데이터(템플릿 5종). 게시판 추가/권한 변경은 코드가 아니라 이 데이터로 |
| `bootstrap_rds.sql` | RDS 최초 1회: `auth.users`·`auth.uid()` 셔임·RLS 적용 앱 롤 `gforest_app` |
| `bootstrap.sh` | 위 두 가지 + (boards 가 비어 있으면) seed 를 순서대로 적용. `local` 이면 샘플 데이터까지 |
| `local/` | 로컬 전용: `sample.sql`(테스트 계정·글), `reset.sh`(`npm run db:reset`) |
| `tools/` | 1회성 컷오버 도구. 평소에는 쓰지 않는다 |

## 적용

| 환경 | 방법 |
|---|---|
| **local** | `npm run db:up` (= `docker compose up` + `db/bootstrap.sh local`). 컨테이너 안 psql 을 쓰므로 libpq 불필요 |
| **dev / prod** | 배포 파이프라인(`ecs-deploy.yml`)이 새 이미지로 서비스를 갱신하기 전에 VPC 안에서 미적용 마이그레이션을 적용한다. 사람이 손으로 돌리지 않는다 |
| 비상(수동) | `AWS_PROFILE=gforest db/bootstrap.sh dev` — RDS 를 잠깐 열어야 한다(`docs/conventions/cicd-and-ops.md` 비상 절차). 끝나면 즉시 닫는다 |

- 재실행해도 안전하다 — 이미 기록된 version 은 건너뛴다. 시드는 `boards` 가 비어 있을 때만 들어간다.

## 마이그레이션 규칙

- 파일명 `<14자리 숫자>_snake_name.sql` (예: `20260910120000_post_tags.sql`). 숫자는 정렬 순서이므로 기존 파일보다 커야 한다.
  기존 `00000000000001_…` 계열은 초기 스키마다.
- 한 파일 = 한 트랜잭션(`psql -1`). 실패하면 통째로 롤백되고 `schema_migrations` 에 기록되지 않는다.
- 적용된 파일은 수정하지 않는다. 고치려면 새 파일.
- **매니지드 서비스(BaaS) 전용 객체 금지**: `storage.*`, `auth.jwt()`, `auth.role()` 등을 쓰지 않는다. 표준 Postgres 만(`pg_dump` 로 탈출 가능해야 한다).
  RLS 는 `auth.uid()` 만 참조 — RDS 에서는 `set_config('app.user_id')` 를 읽는 셔임(`bootstrap_rds.sql`)이다.
- 되도록 하위 호환으로(컬럼 추가는 nullable, 삭제는 다음 릴리스에서) — 롤백이 코드만으로 되게.
- 변경 후 `lib/db/types.ts` 의 Row 타입을 손으로 맞춘다.
