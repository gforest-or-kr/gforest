# 협업·맥락 가이드 (먼저 읽기)

> 이 디렉터리는 **"우리가 어떻게 일하는가"** — 다른 Claude 세션(maestro 등)·새 팀원이
> repo 접근만으로 프로젝트 맥락을 이어받게 하는 실무 규약 모음이다.
> *무엇을 결정했는가*(설계·근거)는 `docs/design`·`docs/research`, *왜 이렇게 만드는가*(원칙)는
> 루트 `CLAUDE.md`. 이 폴더는 그 사이의 **how-to**다.

## 30초 오리엔테이션

- **무엇**: 푸른숲발도르프학교 홈페이지 재구축 (XE1 → Next.js + Postgres, AWS ECS Fargate·RDS·S3). 운영 주체는 전담 인력 없는 비영리 학부모조합 → **최우선 가치 = 유지보수 최소화, 인수인계 가능한 구조**.
- **단일 진실의 경계**:
  - **repo** = 코드 · SQL 마이그레이션 · 다이어그램 원본(`docs/diagrams/*.drawio`)
  - **Jira `GFM`** = 모든 작업 추적 (gforest.atlassian.net)
  - **Confluence `푸른숲-웹-마이그레이션`** = 설계 설명 · 협업 문서 · **비밀값/운영 정보**(팀 전용 페이지)
- **권한은 DB(RLS)가 강제한다** — 앱 코드의 권한 분기는 UI 노출용일 뿐 게이트가 아니다.
- **배포는 GitHub Actions → ECR → ECS**. main push = dev 자동, prod는 수동 실행. 인프라는 `infra/` Terraform.

## 이 폴더의 문서

| 문서 | 언제 읽나 |
|---|---|
| [atlassian.md](./atlassian.md) | Jira 이슈 전환·Confluence 페이지 작성·다이어그램 게시를 할 때 (작성법·페이지 ID·함정) |
| [cicd-and-ops.md](./cicd-and-ops.md) | 배포·백업·모니터링 구조를 이해하거나 워크플로를 만질 때 |
| [code-patterns.md](./code-patterns.md) | 코드를 추가/수정할 때 (RLS·마이그레이션·서버액션·캐싱·렌더링) |

## 함께 읽어야 할 기존 문서

- **`CLAUDE.md`** (루트) — 기술 원칙 9개·개발 워크플로·운영 원칙. **Claude 세션은 자동 로드됨.**
- **`docs/design/rendering.md`** — 렌더링 전략·ISR 쿠키 함정·CI 게이트. **렌더링/데이터패칭 변경 전 필독.**
- **`docs/design/db_schema.md`** — 스키마·RLS·역할 모델·XE 매핑.
- **`docs/design/screen_design.md`** — 화면설계서 v1.1 (21개 화면).
- **`docs/research/decision_infra_stack.md`** — 인프라·스택 의사결정(왜 서버리스·Next.js 풀스택인가).

## 절대 어기면 안 되는 것 (요약 — 상세는 각 문서)

1. **모든 DB 접근은 `withUser()` 트랜잭션 안에서**, `unstable_cache` 콜백에서는 세션 읽기 금지. (`code-patterns.md`)
2. **스키마는 `supabase/migrations/*.sql`로만** 변경, 적용은 `infra/db/bootstrap.sh`. 콘솔 수동 변경 금지. (`code-patterns.md`)
3. **권한 분기를 앱 코드에 중복 구현 금지** → RLS가 단일 진실. (`code-patterns.md`)
4. **Confluence 패널은 `contentFormat: html` + `<div data-type="panel-*">`** → storage-format 매크로는 "Error loading the extension!"로 깨진다. (`atlassian.md`)
5. **장기 AWS 액세스 키 금지** → 사람은 Identity Center, CI는 OIDC 롤. root는 봉인. (`cicd-and-ops.md`)
6. **비밀값을 repo에 커밋 금지** → `.env`(Atlassian)·`.env.local`(DB 접속 문자열). 운영 비밀값은 SSM `/gforest/<env>/…`, 계정 정보는 Confluence 인프라 페이지(팀 전용).
