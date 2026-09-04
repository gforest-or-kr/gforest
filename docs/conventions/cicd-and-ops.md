# CI/CD · 운영 구조

> repo 접근만으로 배포·인프라·계정 체계가 어떻게 도는지 이해하기 위한 문서. 팀 전용 상세(실제
> 비밀값·계정 정보)는 Confluence **05 운영 > "인프라·자격증명 레퍼런스"**. 여기는 repo 안에서
> 자급되는 요약 + 실제로 겪은 함정. 2026-09 AWS 이전 기준(그 이전 프로토타입의 기록은 Confluence 02 리서치·03 설계에만 있다).

## 계정·접근 체계 (인수인계 가능하게)

- **공용 앵커 계정 1개**: `gforest.or.kr@gmail.com` — AWS root(`+aws`)·GitHub Org 청구(`+github`)·AWS 청구(`+billing`) 수신함.
  비밀번호·TOTP 시드·백업코드는 **Bitwarden Organization "gforest"** 금고에만 있다. 사람은 개인 계정, 권한은 조직 단위.
- **GitHub**: Org `gforest-or-kr`, repo `gforest` (public — Free Org에서 브랜치 보호는 public에서만). 멤버는 개인 계정 + 2FA 필수.
- **AWS**: 계정 1개(서울). root는 **봉인**(MFA, 액세스 키 없음, 일상 로그인 금지). 사람은 **IAM Identity Center**
  포털 `https://gforest.awsapps.com/start`(그룹 `admins` = AdministratorAccess 8h). CI는 **OIDC 롤** `gforest-github-deploy`.
  **장기 액세스 키는 어디에도 만들지 않는다.**
- 로컬 CLI: `aws sso login --profile gforest --use-device-code` → `AWS_PROFILE=gforest`. 비용 상한은 Budgets `gforest-monthly`.

## 인프라 = Terraform (`infra/`)

| 스택 | 상태 파일 | 내용 |
|---|---|---|
| `infra/shared` | `s3://gforest-tfstate-…/shared/` | OIDC 롤, ECR, Route 53 존, ACM, VPC(퍼블릭 2AZ, **NAT 없음**), ALB(호스트 라우팅), ECS 클러스터 |
| `infra/env` (workspace `dev`/`prod`) | `…/env/<ws>/` | Fargate 서비스(ARM64), RDS Postgres 17, S3 미디어 버킷, SSM 파라미터, 로그 |

- 적용은 사람이 로컬에서: `terraform workspace select dev && terraform apply -var-file=dev.tfvars`. CI(`infra.yml`)는 PR에서 fmt/validate + OIDC 확인만.
- 비밀값은 **SSM Parameter Store** `/gforest/<env>/{DATABASE_URL,DATABASE_ADMIN_URL,AUTH_SECRET}` → `secret_parameters`로 태스크에 주입. 평문 환경변수는 `*.tfvars`의 `environment`.
- 리소스 크기·월 예산 근거: Confluence 02 리서치 "AWS 이전 예산·리소스 검토"(권장 월 ~$110).

## 배포 = GitHub Actions → ECR → ECS (`.github/workflows/ecs-deploy.yml`)

- **main push → dev 자동 배포**, **`vX.Y.Z` 태그 push → prod 배포**, 수동 실행(workflow_dispatch)은 롤백·재배포용. 규칙은 [branching-and-release.md](./branching-and-release.md). 이미지 태그 `sha-<commit>` + `<env>-latest`.
- ARM 러너(`ubuntu-24.04-arm`)에서 네이티브 빌드 → 태스크 정의에 새 이미지 등록 → `update-service` → `services-stable` 대기 → ALB에 Host 헤더로 `/api/health` 스모크.
- 배포 실패 시 ECS 서킷 브레이커가 이전 태스크 정의로 자동 롤백한다.
- PR 게이트는 `ci.yml`(tsc·eslint·`next build`). **빌드는 DB 없이 통과해야 한다** — 빌드 시점 DB 접근 금지.

## DB 마이그레이션 · 부트스트랩 (`db/`)

- 스키마 단일 진실은 `db/migrations/*.sql`(규칙은 `db/README.md`). 적용: `AWS_PROFILE=gforest db/bootstrap.sh <env>` —
  ① `bootstrap_rds.sql`(auth.users 테이블·`auth.uid()` 셔임·RLS 적용 롤 `gforest_app`) ② 미적용 마이그레이션 순차 적용(`public.schema_migrations` 추적)
  ③ 앱 접속 문자열을 SSM에 기록.
- 앱은 `gforest_app`(테이블 소유자 아님 → RLS 강제)으로 접속. 관리자 접속(`DATABASE_ADMIN_URL`)은 마이그레이션·이관에만.
- RDS는 기본 비공개. 이관·운영 작업 때만 `db_publicly_accessible=true` + `db_allowed_cidrs=[내 IP/32]`로 잠깐 열고 닫는다.
- 이전 시스템 → RDS 이관 절차(1회성, dev 완료·컷오버 때 prod에 반복): `pg_dump --schema=public`, `auth.users` CSV(bcrypt 해시 그대로), `db/tools/` 의 1회성 복사 스크립트(미디어 → S3). `session_replication_role=replica`로 FK 순서 무시 복원. 절차 상세는 `docs/plans/migration_plan.md` §5.

## 백업 · 모니터링

- **백업**: RDS 자동 백업(prod 7일 보존, dev 1일) + 최종 스냅샷. **복원 검증까지 해야 백업이다** — 분기 1회 스냅샷을 dev에 복원해 행수 대조(절차 TODO, GFM 이슈로 관리).
- 로그: CloudWatch `/ecs/gforest-<env>` 14일. 느린 쿼리(>500ms)는 RDS 로그.
- 알림: Budgets 메일(+billing, 담당자). **배포 결과는 Discord**(`ecs-deploy.yml` 마지막 단계, 성공/실패 모두, 시크릿 `DISCORD_WEBHOOK_URL`).

## ⚠️ 실제로 겪은 함정 — 어기면 깨진다

| 함정 | 내용 | 위반 시 |
|---|---|---|
| **GitHub OIDC `sub`는 ID 포함 형식** | `repo:gforest-or-kr@<org_id>/gforest@<repo_id>:…` — 이름만으로 매칭하면 실패 | `Not authorized to perform sts:AssumeRoleWithWebIdentity` |
| **IAM 롤 description에 한글 금지** | ASCII만 허용 | CreateRole ValidationError |
| **HTTPS 리스너는 ACM ISSUED 이후** | DNS 검증 CNAME이 전파돼야 발급. cafe24 NS는 노드별 동기화가 느림(~1h) | `UnsupportedCertificate` |
| **NAT Gateway 만들지 말 것** | 퍼블릭 서브넷 + SG(ALB→앱만)로 충분 | 월 +$45 |
| **`--disable-triggers` 복원 불가** | RDS는 슈퍼유저 없음 → `set session_replication_role = replica` | system trigger permission denied |
| **psql 변수는 DO 블록 안에서 치환 안 됨** | `\gexec` 패턴 사용(`bootstrap_rds.sql`) | syntax error at ":" |
| **`while read` 안에서 aws/curl 호출 시 stdin 격리** | `read -u 3` + `</dev/null` | 루프가 첫 줄에서 끝남 |

## 성능 메모

- 상시 Fargate라 **콜드 스타트 없음**. dev(0.25vCPU/0.5GB) 워밍 TTFB ~0.18–0.25s(ALB 경유). prod는 0.5vCPU/1GB ×2.
- 공개 데이터는 `unstable_cache`(프로세스 내) — 태스크가 2개면 캐시가 각각이므로 태그 무효화는 요청이 닿은 태스크에만 즉시 반영, 나머지는 TTL로 수렴한다(짧은 TTL 유지).
