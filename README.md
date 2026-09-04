# gforest-web

푸른숲발도르프학교(gforest.or.kr) 홈페이지 재구축 — 지원 종료된 XpressEngine 1.x 사이트를 **Next.js + AWS**로 이전합니다.
전담 운영 인력이 없는 비영리 학부모조합이 운영하므로 **유지보수에 손이 덜 가는 구조**가 최우선 가치입니다.
기존 사이트(gforest.or.kr)는 컷오버 전까지 cafe24에서 그대로 운영됩니다.

## 스택

| 레이어 | 선택 |
|---|---|
| 앱 | Next.js (App Router, TypeScript, Tailwind v4) |
| 실행 환경 | ECS Fargate(ARM64) + ALB — 서울 리전(ap-northeast-2), 상시 구동 |
| DB | RDS Postgres 17 — 권한은 RLS(`auth.uid()` 셔임)로 강제 |
| 인증 | Auth.js Credentials (이메일/비밀번호, JWT 쿠키, bcrypt) |
| 미디어 | S3 + presigned URL (`lib/storage.ts`) |
| 인프라 | Terraform `infra/` (shared + env dev/prod), 비밀값은 SSM Parameter Store |
| 배포 | GitHub Actions → ECR → ECS (`ecs-deploy.yml`) |

## 로컬 개발 (AWS 계정 불필요)

개발은 각자 로컬에서 한다 — Docker Compose 의 Postgres 17 + MinIO(S3 호환)가 DB·미디어 저장소를 대신한다. **AWS 접근은 필요 없다.**

```bash
git clone git@github.com:gforest-or-kr/gforest.git && cd gforest
npm ci
cp .env.local.example .env.local   # 기본값이 docker compose 기준이라 그대로 쓰면 된다
npm run db:up                      # Postgres·MinIO 기동 + 스키마·시드·샘플 데이터 적용
npm run dev                        # http://localhost:3000
```

- 필요한 것: Node 22, Docker Desktop, `gh`. (`psql` 불필요 — 컨테이너 안의 psql 을 쓴다)
- 테스트 계정: `admin.test@gforest.kr` / `member.test@gforest.kr` 등, 비밀번호 `DevTest!2026` (`db/local/sample.sql` 상단). 로컬 전용이며 dev/prod 에는 없다.
- `npm run db:reset` — 볼륨까지 지우고 처음부터. 스키마를 만지다 꼬였을 때. `npm run db:down` — 컨테이너 정지.
- **PR 올리기 전 `npm run check`**(tsc·eslint·`next build`) — CI 의 `ci` 잡과 같은 검사다.
- 메일은 `MAIL_FROM` 이 없으면 서버 콘솔에 출력된다(비밀번호 재설정 링크 확인용). MinIO 콘솔은 http://localhost:9001 (minioadmin/minioadmin).
- DB 스키마: `db/migrations/` + 게시판 시드 `db/seed.sql`. 규칙은 `db/README.md`. dev/prod 에는 배포 파이프라인이 적용한다.

## 디렉터리

```
app/                    Next.js App Router 페이지·서버 액션
components/             UI 컴포넌트
lib/db/                 pg 풀 + withUser() 트랜잭션(RLS 컨텍스트), Row 타입
lib/auth.ts             Auth.js 세션 (getSessionUserId / getSessionProfile)
lib/storage.ts          S3 presigned URL (서버 전용)
db/                     스키마 SQL(migrations/, 단일 진실)·seed.sql·bootstrap.sh — db/README.md
infra/shared/           Terraform: OIDC 롤·ECR·Route 53·ACM·VPC·ALB·ECS 클러스터
infra/env/              Terraform: Fargate 서비스·RDS·S3·SSM (workspace dev/prod)
.github/workflows/      ci.yml(PR 게이트) · ecs-deploy.yml(배포) · infra.yml(Terraform 검증)
docs/                   plans/ research/ design/ conventions/ diagrams/
```

## 배포 흐름

1. PR → `ci.yml` (tsc · eslint · `next build`, DB 없이 통과해야 함)
2. squash merge → `main` push → `ecs-deploy.yml`이 **dev 자동 배포** (ALB `/api/health` 스모크 포함)
3. **prod는 `vX.Y.Z` 태그**(Owner가 main 커밋에 생성) → `ecs-deploy.yml`이 prod 배포. 롤백·재배포는 workflow_dispatch ([docs/conventions/branching-and-release.md](./docs/conventions/branching-and-release.md))
4. 배포 실패 시 ECS 서킷 브레이커가 이전 태스크 정의로 자동 롤백

## 문서

- **개발 원칙**: [CLAUDE.md](./CLAUDE.md) — 기술·운영 원칙 (기여 전 필독)
- **협업 실무 (온보딩)**: [docs/conventions/](./docs/conventions/README.md) — Jira·Confluence 작성, CI/CD 구조, 코드 패턴
- **이슈/진행 관리**: [Jira GFM 프로젝트](https://gforest.atlassian.net/jira/software/projects/GFM/boards/1)
- **설계 문서**: [Confluence 푸른숲-웹-마이그레이션](https://gforest.atlassian.net/wiki/spaces/gforestMigration/overview)

## 주의

- **비밀값 커밋 금지**: `.env`·`.env.local`은 gitignore. 실제 값은 SSM과 Confluence "인프라·자격증명 레퍼런스"에만.
- **빌드 시점 DB 접근 금지**: CI 빌드는 DB 없이 돈다 (`generateStaticParams` 등에서 쿼리하지 말 것).
- **권한 분기 중복 구현 금지**: 게시판 권한은 `boards` 데이터 + RLS가 강제한다. 앱 코드의 검사는 UI 노출 제어용일 뿐.

비영리 학부모조합 내부 프로젝트입니다.
