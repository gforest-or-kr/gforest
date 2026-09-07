# 사례별 작업 절차서 (playbooks)

> "이런 상황이면 이렇게 한다"를 사례별로 적은 문서. 사람도 Claude 세션도 **해당 사례를 찾아 그대로 따른다.**
> 원칙은 `CLAUDE.md`, 규칙의 이유는 각 규약 문서([README](./README.md))에 있다. 여기는 순서만 있다.
> 모든 사례의 공통 뼈대: **`/task GFM-n` → 로컬에서 만들고 검증 → `/pr` → develop 병합 → dev 에서 눈으로 확인.**
>
> **절차의 원본은 두 곳으로 나뉜다.** 판단이 필요한 사례(§1·2·5·7·8·9·13)는 `.claude/skills/<이름>/SKILL.md` 가 원본이다 — Claude 세션이 `/이름` 으로 호출하면 그 순서가 로드되고, `/compact`(요약) 뒤에도 다시 호출하면 복구된다. 사람은 같은 파일을 읽으면 된다. 나머지 사례는 이 문서가 원본이다.

| 사례 | 원본 | 바로가기 |
|---|---|---|
| DB 스키마를 바꾼다 | skill `db-migration` | [§1](#1-db-스키마-변경) |
| 게시판을 추가·수정·권한 변경한다 | skill `add-board` | [§2](#2-게시판-추가수정권한-변경) |
| 화면·기능을 추가한다 | 이 문서 | [§3](#3-화면기능-추가) |
| 버그를 고친다 | 이 문서 | [§4](#4-버그-수정) |
| prod 가 급하다 (핫픽스) | skill `hotfix` | [§5](#5-핫픽스) |
| prod 에 내보낸다 (릴리스) | 이 문서 + `/release` | [§6](#6-릴리스) |
| 환경변수·비밀값을 추가한다 | skill `env-var` | [§7](#7-환경변수비밀값-추가) |
| 인프라(Terraform)를 바꾼다 | skill `infra-change` | [§8](#8-인프라-변경) |
| dev 데이터를 다시 넣는다 | skill `dev-reseed` | [§9](#9-dev-데이터-재투입) |
| 로컬이 꼬였다 | 이 문서 | [§10](#10-로컬-환경-복구) |
| 세션을 끝낸다 / 이어받는다 | 이 문서 + `/handover` `/task` | [§11](#11-세션-인수인계) |
| 문서·다이어그램을 고친다 | 이 문서 | [§12](#12-문서다이어그램-갱신) |
| dev/prod DB 를 직접 봐야 한다 | skill `dbshell` | [§13](#13-운영-db-조회-dbshell) |

---

## 1. DB 스키마 변경

**원본**: [`.claude/skills/db-migration/SKILL.md`](../../.claude/skills/db-migration/SKILL.md) · 규칙: [`.claude/rules/db.md`](../../.claude/rules/db.md), [`db/README.md`](../../db/README.md)

요지: `db/migrations/<14자리>_<snake>.sql` 새 파일 → `npm run db:up` → `lib/db/types.ts` Row 타입 → `npm run check` → `/pr` → 병합 시 파이프라인이 서비스 갱신 전에 dev RDS 에 적용. 적용된 파일 수정 금지, 하위 호환(추가는 nullable, 삭제는 다음 릴리스), 표준 Postgres 만, `legacy_*` 불변.

## 2. 게시판 추가·수정·권한 변경

**원본**: [`.claude/skills/add-board/SKILL.md`](../../.claude/skills/add-board/SKILL.md)

요지: 코드가 아니라 데이터다 — 관리자 화면 `/admin/boards` 로 추가·수정(저장 시 `menu` 태그 무효화). 모든 환경에 필요한 초기값은 `db/seed.sql` 에도. 권한은 `read_roles/write_roles` + RLS 가 판단하고 앱에 분기를 두지 않는다. 통폐합은 ETL 매핑(`mapping.json`, `legacy_mid`).

## 3. 화면·기능 추가

**순서**
1. `/task GFM-n` (이슈 없으면 먼저 만든다 — 한 이슈 = 한 브랜치 = 한 PR).
2. 데이터 접근은 서버에서만: 서버 컴포넌트·서버 액션 안에서 `withUser(userId, …)` (공개 데이터는 `withUser(null, …)` + `unstable_cache` + 태그). 클라이언트 컴포넌트는 서버 액션만 호출한다. 패턴은 [code-patterns.md](./code-patterns.md) §3~§6 (Claude 는 `app/**`·`lib/**` 를 열면 `.claude/rules/app.md` 가 자동 로드된다).
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

**원본**: [`.claude/skills/hotfix/SKILL.md`](../../.claude/skills/hotfix/SKILL.md) · 규칙: [branching-and-release.md](./branching-and-release.md) §5

요지: 급하지 않으면 develop 을 거친다. 급하면 `origin/main` 에서 `hotfix/GFM-n-<slug>` → PR base=main(`release-guard` 허용) → **merge commit** → Owner 가 prod 배포 승인 → 태그 자동 → `sync-develop` 이 연 역병합 PR 을 merge commit 으로.

## 6. 릴리스

**누가**: Owner(또는 릴리스 담당). **주기**: 팀이 정한 시점(안정화 단계 이후). 컷오버 전에는 `prod.gforest.or.kr` 로 나간다.

1. develop 이 dev 에서 확인된 상태인지 본다(`/version`, 최근 PR 들의 "확인" 항목).
2. `/release` — develop → main PR 이 열리고 본문에 포함 PR·마이그레이션 여부가 채워진다.
3. `ci`·`release-guard` 초록 → **merge commit** 병합(룰셋이 squash 를 막는다).
4. Actions → `ecs-deploy` → prod 배포 승인(environment `prod`). 마이그레이션 → 서비스 갱신 → 스모크 → 태그 `vYYYY.MM.DD` + Release 자동.
5. `https://prod.gforest.or.kr/version`(컷오버 후 `gforest.or.kr`) 확인. Discord 알림 확인.
6. 문제가 있으면 **롤백**: Actions → `ecs-deploy` → Run workflow, ref=이전 태그, environment=prod. 마이그레이션이 포함된 릴리스는 코드 롤백만으로 안 될 수 있다 — §1 의 하위 호환 규칙이 이걸 지켜준다.

## 7. 환경변수·비밀값 추가

**원본**: [`.claude/skills/env-var/SKILL.md`](../../.claude/skills/env-var/SKILL.md)

요지: 평문은 `infra/env/*.tfvars` `environment` + `.env.local.example` → 인프라 담당 apply. 비밀값은 값을 어디에도 쓰지 않고 SSM `/gforest/<env>/<NAME>` + `secret_parameters` 이름만. 로컬은 `.env.local`. 채팅에 붙여넣은 키는 로테이션.

## 8. 인프라 변경

**원본**: [`.claude/skills/infra-change/SKILL.md`](../../.claude/skills/infra-change/SKILL.md) · 규칙: [`.claude/rules/infra.md`](../../.claude/rules/infra.md), [cicd-and-ops.md](./cicd-and-ops.md)

요지: `infra/GFM-n-<slug>` 브랜치 → `terraform fmt`·`validate`·`plan` 을 PR 본문에 요약 → 병합 후 담당자가 로컬에서 apply(dev 먼저, prod 는 별도 시점). 콘솔 리소스는 없는 것, 비용은 Budgets 와 대조, RDS 비상 개방은 즉시 되돌린다.

## 9. dev 데이터 재투입

**원본**: [`.claude/skills/dev-reseed/SKILL.md`](../../.claude/skills/dev-reseed/SKILL.md) · 도구: [`db/tools/xe/README.md`](../../db/tools/xe/README.md)

요지: 로컬은 `npm run db:reset` → `npm run xe:etl -- --anonymize` → (선택) `npm run xe:files -- --since 2025`. dev 는 인프라 담당이 RDS 비상 개방 → `reset-env.sh dev` → ETL → 첨부 복사 → 닫기. prod 에는 실행되지 않는다.

## 10. 로컬 환경 복구

| 증상 | 처방 |
|---|---|
| DB 가 이상하다, 마이그레이션이 꼬였다 | `npm run db:reset` (볼륨 삭제 후 스키마·시드·샘플 재생성) |
| 첨부 이미지가 안 뜬다 | 파일 본체가 MinIO 에 없다 — `npm run xe:files -- --since 2025`. 새로 올린 파일이 안 뜨면 `.env.local` 의 `S3_ENDPOINT`·`MEDIA_BUCKET` 확인 |
| 로그인이 안 된다 | 이관 계정은 비밀번호가 없다(재설정 전제). 테스트 계정 `admin.test@gforest.kr` 등 / `DevTest!2026` |
| 메일이 안 온다 | `MAIL_FROM` 없으면 서버 콘솔에 링크가 찍힌다(정상) |
| `docker compose` 이미지 pull 이 멈춘다 | Docker Desktop 재시작. 그래도 안 되면 잠시 뒤 재시도(2026-09-05 겪음 — 몇 시간 뒤 저절로 풀림) |
| `next build` 는 되는데 CI 가 깨진다 | 빌드 시점 DB 접근이 들어갔다(§3-6) |
| Claude 가 compact 뒤에 규칙을 잊은 것 같다 | hook 이 띄운 skill 목록에서 해당 사례를 다시 호출시킨다(`/db-migration` 등). `/context` 로 CLAUDE.md·rules 로드 여부 확인 |

## 11. 세션 인수인계

- 끝낼 때: PR 을 올렸으면 `/pr` 이 Jira 코멘트까지 남긴다. 못 올렸으면 **`/handover`** — push + Jira 에 "한 것/남은 것/막힌 것".
- 이어받을 때: `/task GFM-n` 이 이슈 본문과 인수인계 코멘트를 요약해 준다. 다른 사람의 브랜치를 이어 쓰지 말고, 남은 일이 크면 이슈를 쪼갠다.
- 개인 메모리·채팅 기록은 머신을 넘지 않는다. 팀이 알아야 할 사실은 이 문서들 또는 Confluence 로.
- 긴 세션에서 `/compact` 가 돌면 대화는 요약으로 바뀐다. CLAUDE.md·rules·호출했던 skill 은 복구되지만 Read 로 읽은 문서 내용은 사라진다 — `.claude/hooks/on-compact.sh` 가 브랜치·이슈·skill 목록을 다시 띄우고, Claude 는 진행 중 사례의 skill 을 다시 호출한 뒤 계속한다([claude-code.md](./claude-code.md) §2-2).

## 12. 문서·다이어그램 갱신

- 규칙이 바뀌면 **repo 문서가 먼저**(`CLAUDE.md` = 원칙, `docs/conventions/` = 절차, `.claude/skills` = 절차의 Claude 실행본, `docs/design` = 근거). Confluence 의 규약 페이지는 미러 — 같은 PR 에서 갱신하거나 PR 본문에 "Confluence 갱신 필요" 를 남긴다.
- skill 을 고치면 이 문서의 요지도, 규칙(`.claude/rules`)을 고치면 해당 규약 문서도 같은 PR 에서 맞춘다. 두 곳이 어긋나면 skill/rule 이 아니라 **문서를 원본 쪽에 맞춘다**(skill 이 원본인 사례는 skill 이 이긴다).
- 다이어그램은 `docs/diagrams/*.drawio` 가 원본. 고치면 PNG 도 다시 만들어 Confluence 에 올린다(모바일 앱은 draw.io 매크로를 못 그린다). 작성법·페이지 ID 는 [atlassian.md](./atlassian.md).
- 결정·함정을 새로 겪었으면 [cicd-and-ops.md](./cicd-and-ops.md) 의 함정 표 또는 이 문서에 한 줄 추가한다.

## 13. 운영 DB 조회 (dbshell)

**원본**: [`.claude/skills/dbshell/SKILL.md`](../../.claude/skills/dbshell/SKILL.md) · 도구: `db/tools/dbshell.sh`

요지: 인프라 담당만. `aws sso login --profile gforest --use-device-code` → `AWS_PROFILE=gforest db/tools/dbshell.sh dev --readonly`(기본) / 관리자 / `--app`(RLS 재현). VPC 안 컨테이너 + ECS Exec, RDS 는 계속 비공개, 기록은 CloudWatch `/ecs/gforest-exec`. prod 는 `--readonly` 만.
