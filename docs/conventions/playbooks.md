# 사례별 작업 절차서 (playbooks)

> "이런 상황이면 이렇게 한다"를 사례별로 적은 문서. 사람도 Claude 세션도 **해당 사례를 찾아 그대로 따른다.**
> 원칙은 `CLAUDE.md`, 규칙의 이유는 각 규약 문서([README](./README.md))에 있다. 여기는 순서만 있다.
> 모든 사례의 공통 뼈대: **`/task GFM-n` → 로컬에서 만들고 검증 → `/pr` → develop 병합 → dev 에서 눈으로 확인.**

| 사례 | 바로가기 |
|---|---|
| DB 스키마를 바꾼다 | [§1](#1-db-스키마-변경) |
| 게시판을 추가·수정·권한 변경한다 | [§2](#2-게시판-추가수정권한-변경) |
| 화면·기능을 추가한다 | [§3](#3-화면기능-추가) |
| 버그를 고친다 | [§4](#4-버그-수정) |
| prod 가 급하다 (핫픽스) | [§5](#5-핫픽스) |
| prod 에 내보낸다 (릴리스) | [§6](#6-릴리스) |
| 환경변수·비밀값을 추가한다 | [§7](#7-환경변수비밀값-추가) |
| 인프라(Terraform)를 바꾼다 | [§8](#8-인프라-변경) |
| dev 데이터를 다시 넣는다 | [§9](#9-dev-데이터-재투입) |
| 로컬이 꼬였다 | [§10](#10-로컬-환경-복구) |
| 세션을 끝낸다 / 이어받는다 | [§11](#11-세션-인수인계) |
| 문서·다이어그램을 고친다 | [§12](#12-문서다이어그램-갱신) |

---

## 1. DB 스키마 변경

**언제**: 테이블·컬럼·인덱스·RLS 정책·함수·트리거를 바꿀 때. (게시판 추가는 §2 — 스키마가 아니라 데이터다.)

**순서**
1. `db/migrations/<14자리>_<snake_name>.sql` 새 파일. 숫자는 기존 파일보다 크게(`date +%Y%m%d%H%M%S`). 한 파일 = 한 가지 변경 = 한 트랜잭션.
2. `npm run db:up` — 미적용 파일만 로컬 Postgres 에 순서대로 적용된다. 처음부터 다시 보려면 `npm run db:reset`.
3. `lib/db/types.ts` 의 Row 타입을 새 컬럼에 맞춘다. 쿼리·화면을 고친다.
4. 새 테이블이면 같은 파일 안에 `alter table … enable row level security` + `create policy …` 를 기존 `posts` 정책을 본떠 쓴다. `gforest_app` 권한은 기본 권한 설정으로 자동으로 붙는다.
5. `npm run dev` 로 화면 확인 → `npm run check` → `/pr`.
6. develop 병합 → 배포 파이프라인이 **서비스 갱신 전에** `gforest-dev-migrate` 태스크로 이 파일을 dev RDS 에 적용한다. Actions 로그에서 `apply <파일명>` / `migrations: 1 applied` 확인. 실패하면 앱은 이전 버전 그대로다.
7. prod 에는 릴리스(§6) 때 같은 단계가 실행된다.

**하지 말 것**
- 이미 적용된 파일 수정(고치려면 새 파일). RDS 콘솔·psql 로 dev/prod 직접 변경.
- 하위 호환 깨기: 컬럼 삭제·이름 변경은 코드가 더는 쓰지 않는 **다음 릴리스**에서. 추가 컬럼은 nullable 또는 default.
- 트랜잭션 안에서 못 도는 문장(`create index concurrently` 등).
- BaaS 전용 객체(`storage.*`, `auth.jwt()`) — 표준 Postgres 만.

**확인**: 로컬 `docker compose exec -T db psql -U gforest_admin -d gforest -c "select * from schema_migrations order by 1"`, dev 는 배포 로그.

## 2. 게시판 추가·수정·권한 변경

**언제**: 게시판을 새로 만들거나, 이름·메뉴 위치·읽기/쓰기 역할·유형(list/gallery/calendar/reservation)을 바꿀 때.

**순서**
1. **코드가 아니라 데이터다.** 관리자 화면(`/admin/boards`, admin 계정)에서 추가·수정한다. 저장 시 `menu` 태그가 무효화돼 헤더·목록에 즉시 반영된다.
2. 권한 판단은 `boards.read_roles / write_roles` + RLS 가 한다. 화면 코드에 `if (role === …)` 를 새로 넣지 않는다(있다면 UI 노출용일 뿐).
3. **모든 환경에 같은 초기값이 필요한 게시판**(새로 만드는 환경에서도 있어야 하는 것)은 `db/seed.sql` 에도 넣는다. 시드는 `boards` 가 비어 있을 때만 들어가므로 기존 환경에는 관리자 화면으로 같은 내용을 넣어야 한다.
4. 통폐합(옛 게시판 글을 다른 게시판으로 옮기기)은 **ETL 매핑**(`db/tools/xe/mapping.json`, `boards.legacy_mid`)으로 한다 — 컷오버 전까지는 dev 에 다시 투입(§9)하면 반영된다. 컷오버 후에는 `update posts set board_id …` 마이그레이션(§1).

**하지 말 것**: 게시판마다 페이지·컴포넌트 새로 만들기(템플릿 5종으로 끝나야 한다), 권한 분기 중복 구현.

**확인**: 비로그인·member·operator 계정으로 각각 목록이 보이는지/안 보이는지. 테스트 계정은 `db/local/sample.sql`(로컬·dev 공통).

## 3. 화면·기능 추가

**순서**
1. `/task GFM-n` (이슈 없으면 먼저 만든다 — 한 이슈 = 한 브랜치 = 한 PR).
2. 데이터 접근은 서버에서만: 서버 컴포넌트·서버 액션 안에서 `withUser(userId, …)` (공개 데이터는 `withUser(null, …)` + `unstable_cache` + 태그). 클라이언트 컴포넌트는 서버 액션만 호출한다. 패턴은 [code-patterns.md](./code-patterns.md) §3~§6.
3. 쓰기 액션은 성공 후 관련 태그를 무효화한다(`board:<slug>`, `post:<id>`, `menu`). 표는 `docs/design/rendering.md`.
4. 모바일 퍼스트 단일 반응형, 탭 타겟 44px+, 다크모드 없음. 색은 `app/globals.css` 의 forest 팔레트.
5. 이미지 업로드는 `createUploadUrl` → presigned PUT (로컬은 MinIO). 새 업로드 종류를 만들지 않는다.
6. 빌드 시점 DB 접근 금지(`generateStaticParams`, 정적 라우트에서 쿼리 X) — CI 는 DB 없이 빌드한다.
7. `npm run check` → `/pr` → 병합 → `https://dev.gforest.or.kr/version` 에서 내 커밋 확인 → 화면 확인.

**하지 말 것**: 새 라이브러리 추가(필요하면 PR 본문에 이유), 클라이언트에서 DB/인증 직접 접근, 큰 PR(며칠 넘게 들고 있기).

## 4. 버그 수정

1. 재현을 먼저 로컬에서. 데이터가 필요하면 §9 의 로컬 투입(가명화 XE 데이터)으로 실제 글 모양을 만든다.
2. `fix/GFM-n-<slug>` 브랜치. 원인을 PR 본문 `## 무엇을 / 왜` 에 한 줄로.
3. RLS 거부(42501)·unique 위반(23505)은 버그가 아니라 정책일 수 있다 — `pgCode()` 로 분기해 사용자 메시지로 바꾼다.
4. 나머지는 §3 과 같다. prod 가 지금 아프면 §5.

## 5. 핫픽스

**언제**: prod 에 당장 고쳐야 할 문제가 있고, develop 에는 아직 내보내면 안 되는 변경이 섞여 있을 때. 급하지 않으면 그냥 develop 을 거친다(더 단순하다).

1. `git fetch && git checkout -b hotfix/GFM-n-<slug> origin/main`.
2. 수정 → 로컬 검증 → `npm run check` → PR **base=main** (`release-guard` 가 hotfix/* 를 허용한다).
3. `ci`·`release-guard` 초록 → **merge commit** 으로 병합 → Actions 에서 Owner 가 prod 배포 승인 → 태그 자동.
4. 배포 후 `sync-develop` 워크플로가 `main → develop` 역병합 PR 을 연다 → 확인하고 **merge commit** 으로 합친다(squash 금지).
5. Jira 이슈에 "핫픽스로 나감" 을 남긴다.

## 6. 릴리스

**누가**: Owner(또는 릴리스 담당). **주기**: 팀이 정한 시점(안정화 단계 이후). 컷오버 전에는 `prod.gforest.or.kr` 로 나간다.

1. develop 이 dev 에서 확인된 상태인지 본다(`/version`, 최근 PR 들의 "확인" 항목).
2. `/release` — develop → main PR 이 열리고 본문에 포함 PR·마이그레이션 여부가 채워진다.
3. `ci`·`release-guard` 초록 → **merge commit** 병합(룰셋이 squash 를 막는다).
4. Actions → `ecs-deploy` → prod 배포 승인(environment `prod`). 마이그레이션 → 서비스 갱신 → 스모크 → 태그 `vYYYY.MM.DD` + Release 자동.
5. `https://prod.gforest.or.kr/version`(컷오버 후 `gforest.or.kr`) 확인. Discord 알림 확인.
6. 문제가 있으면 **롤백**: Actions → `ecs-deploy` → Run workflow, ref=이전 태그, environment=prod. 마이그레이션이 포함된 릴리스는 코드 롤백만으로 안 될 수 있다 — §1 의 하위 호환 규칙이 이걸 지켜준다.

## 7. 환경변수·비밀값 추가

**평문 값**(URL, 버킷 이름, 플래그): `infra/env/dev.tfvars`·`prod.tfvars` 의 `environment` 에 추가 → `.env.local.example` 에도 추가 → 인프라 담당이 `terraform apply` → 다음 배포부터 반영(워크플로가 최신 태스크 정의를 복제한다). 코드에서는 `process.env.X`, 없을 때 기본값을 둔다.

**비밀값**(토큰, 키): 코드·tfvars·`.env.local.example` 에 값을 쓰지 않는다. 인프라 담당이 SSM `/gforest/<env>/<NAME>` 에 넣고 `secret_parameters` 에 이름만 추가 → apply. 로컬은 `.env.local` 에 본인 값. 채팅에 붙여넣은 키는 오염된 것으로 보고 로테이션한다.

**빌드 시점에 필요한 값**(`NEXT_PUBLIC_*`)은 `ecs-deploy.yml` 의 build-args 로 넘겨야 한다 — 드물다. 필요하면 인프라 담당과 PR.

## 8. 인프라 변경

**누가**: 인프라 담당(AWS SSO 보유자). 개발자는 PR 로 제안할 수 있다(`infra/**` 변경 PR 은 `infra` 워크플로가 fmt/validate 를 돈다).

1. `infra/GFM-n-<slug>` 브랜치. `infra/shared`(계정 공통) 또는 `infra/env`(환경별) 수정. 리전 변수는 바꾸지 않는다.
2. `terraform fmt` → `terraform validate` → `terraform plan -var-file=dev.tfvars` 결과를 **PR 본문에 요약**(추가/변경/삭제 개수와 대상).
3. 병합 후 담당자가 로컬에서 `aws sso login --profile gforest --use-device-code` → `terraform workspace select dev && terraform apply -var-file=dev.tfvars`. prod 는 릴리스와 별개로 담당자가 시점을 정해 apply.
4. **콘솔에서 만든 리소스는 존재하지 않는 것**으로 취급한다(Terraform 밖). 비용이 붙는 리소스는 Budgets 문서와 대조.
5. RDS 비상 개방(`db_publicly_accessible=true` + 본인 IP)은 작업 후 **즉시** 되돌린다 — 켜 둔 채 퇴근하지 않는다.

## 9. dev 데이터 재투입

**언제**: 게시판 매핑·역할 규칙을 바꿔 실제 글 모양을 다시 보고 싶을 때, dev 데이터가 어지러워졌을 때. 로컬은 언제든, dev 는 인프라 담당이.

**로컬**: `npm run db:reset` → `npm run xe:etl -- --anonymize` (20초) → 필요하면 `npm run xe:files -- --since 2025` (첨부 본체, 900MB). XE 복제본이 없으면 `db/tools/xe/README.md` §1.

**dev**(인프라 담당): RDS 비상 개방 → `db/tools/xe/reset-env.sh dev` → ETL(가명화) → 첨부 복사 → RDS 닫기. 명령은 `db/tools/xe/README.md` §2. 테스트 계정 4개는 자동으로 다시 생긴다. **prod 에는 이 스크립트가 실행되지 않는다.**

## 10. 로컬 환경 복구

| 증상 | 처방 |
|---|---|
| DB 가 이상하다, 마이그레이션이 꼬였다 | `npm run db:reset` (볼륨 삭제 후 스키마·시드·샘플 재생성) |
| 첨부 이미지가 안 뜬다 | 파일 본체가 MinIO 에 없다 — `npm run xe:files -- --since 2025`. 새로 올린 파일이 안 뜨면 `.env.local` 의 `S3_ENDPOINT`·`MEDIA_BUCKET` 확인 |
| 로그인이 안 된다 | 이관 계정은 비밀번호가 없다(재설정 전제). 테스트 계정 `admin.test@gforest.kr` 등 / `DevTest!2026` |
| 메일이 안 온다 | `MAIL_FROM` 없으면 서버 콘솔에 링크가 찍힌다(정상) |
| `docker compose` 이미지 pull 이 멈춘다 | Docker Desktop 재시작. 그래도 안 되면 잠시 뒤 재시도(2026-09-05 겪음 — 몇 시간 뒤 저절로 풀림) |
| `next build` 는 되는데 CI 가 깨진다 | 빌드 시점 DB 접근이 들어갔다(§3-6) |

## 11. 세션 인수인계

- 끝낼 때: PR 을 올렸으면 `/pr` 이 Jira 코멘트까지 남긴다. 못 올렸으면 **`/handover`** — push + Jira 에 "한 것/남은 것/막힌 것".
- 이어받을 때: `/task GFM-n` 이 이슈 본문과 인수인계 코멘트를 요약해 준다. 다른 사람의 브랜치를 이어 쓰지 말고, 남은 일이 크면 이슈를 쪼갠다.
- 개인 메모리·채팅 기록은 머신을 넘지 않는다. 팀이 알아야 할 사실은 이 문서들 또는 Confluence 로.

## 12. 문서·다이어그램 갱신

- 규칙이 바뀌면 **repo 문서가 먼저**(`CLAUDE.md` = 원칙, `docs/conventions/` = 절차, `docs/design` = 근거). Confluence 의 규약 페이지는 미러 — 같은 PR 에서 갱신하거나 PR 본문에 "Confluence 갱신 필요" 를 남긴다.
- 다이어그램은 `docs/diagrams/*.drawio` 가 원본. 고치면 PNG 도 다시 만들어 Confluence 에 올린다(모바일 앱은 draw.io 매크로를 못 그린다). 작성법·페이지 ID 는 [atlassian.md](./atlassian.md).
- 결정·함정을 새로 겪었으면 [cicd-and-ops.md](./cicd-and-ops.md) 의 함정 표 또는 이 문서에 한 줄 추가한다.
