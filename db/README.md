# db/ — 스키마 단일 진실

RDS Postgres 스키마·시드·부트스트랩. **콘솔 수동 변경 금지** — 여기 있는 SQL 만이 진실이다(CLAUDE.md 원칙 2).

| 경로 | 내용 |
|---|---|
| `migrations/*.sql` | 스키마 마이그레이션. 번호 순서대로 1회씩 적용되며 `public.schema_migrations` 에 기록 |
| `seed.sql` | 게시판 33개 데이터(템플릿 5종). 게시판 추가/권한 변경은 코드가 아니라 이 데이터로 |
| `bootstrap_rds.sql` | RDS 최초 1회: `auth.users`·`auth.uid()` 셔임·RLS 적용 앱 롤 `gforest_app` |
| `bootstrap.sh` | 위 두 가지를 순서대로 적용하고 앱 접속 문자열을 SSM 에 기록 |
| `tools/` | 1회성 컷오버 도구(이전 시스템 미디어 → S3 복사 스크립트). 평소에는 쓰지 않으며 이전 시스템 폐기 후 삭제한다 |

## 적용

```sh
aws sso login --profile gforest --use-device-code   # 필요 시
AWS_PROFILE=gforest db/bootstrap.sh dev              # prod 도 같은 방식
```

- 재실행해도 안전하다 — 이미 기록된 version 은 건너뛴다.
- 관리자 접속 문자열(`/gforest/<env>/DATABASE_ADMIN_URL`)이 SSM 에 있어야 하고, RDS 가 이 머신에서 접근 가능해야 한다
  (`infra/env` 의 `db_publicly_accessible` + `db_allowed_cidrs`).

## 마이그레이션 규칙

- 파일명 `<14자리 숫자>_snake_name.sql` (예: `20260910120000_post_tags.sql`). 숫자는 정렬 순서이므로 기존 파일보다 커야 한다.
  기존 `00000000000001_…` 계열은 초기 스키마다.
- 한 파일 = 한 트랜잭션(`psql -1`). 실패하면 통째로 롤백되고 `schema_migrations` 에 기록되지 않는다.
- 적용된 파일은 수정하지 않는다. 고치려면 새 파일.
- **매니지드 서비스(BaaS) 전용 객체 금지**: `storage.*`, `auth.jwt()`, `auth.role()` 등을 쓰지 않는다. 표준 Postgres 만(`pg_dump` 로 탈출 가능해야 한다).
  RLS 는 `auth.uid()` 만 참조 — RDS 에서는 `set_config('app.user_id')` 를 읽는 셔임(`bootstrap_rds.sql`)이다.
- 되도록 하위 호환으로(컬럼 추가는 nullable, 삭제는 다음 릴리스에서) — 롤백이 코드만으로 되게.
- 변경 후 `lib/db/types.ts` 의 Row 타입을 손으로 맞춘다.
