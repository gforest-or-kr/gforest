---
paths:
  - "infra/**"
  - ".github/**"
  - "Dockerfile"
  - "docker-compose.yml"
---
# 인프라·CI 규칙 (infra/**, .github/**) — 이유·상세: `docs/conventions/cicd-and-ops.md`, `branching-and-release.md`

- 리전은 `ap-northeast-2` 고정. 리전 변수를 바꾸지 않는다.
- 장기 AWS 액세스 키를 어디에도 만들지 않는다. 사람은 Identity Center(SSO 프로필 `gforest`), CI 는 OIDC 롤 `gforest-github-deploy`. root 는 봉인.
- 비밀값은 SSM `/gforest/<env>/<NAME>` 에 넣고 `secret_parameters` 에 **이름만** 추가. tfvars·워크플로·코드에 값을 쓰지 않는다. 평문은 `*.tfvars` 의 `environment` + `.env.local.example`.
- `terraform fmt` → `validate` → `plan -var-file=<env>.tfvars` 결과를 PR 본문에 요약. **apply 는 사람이 로컬에서** — Claude 는 plan 을 보여주고 승인 후에만. `terraform destroy` 금지.
- 콘솔에서 만든 리소스는 존재하지 않는 것. 비용 리소스 추가 전 Budgets `gforest-monthly`(월 USD 110) 와 대조.
- RDS 는 비공개(`db_publicly_accessible = false`). 비상 개방은 본인 IP `/32` 로, 작업 후 **즉시** 되돌려 apply.
- prod 는 repo 변수 `PROD_ENABLED` 와 environment `prod` 승인으로 게이트. 배포 순서(이미지 빌드 → migrate 태스크 → 서비스 갱신 → 스모크 → Discord)를 깨지 않는다.
- 워크플로 잡 이름 `ci`·`release-guard` 는 룰셋 필수 체크다 — 이름을 바꾸면 병합이 막힌다. `sync-develop` 은 main→develop 역병합 PR 을 연다(merge commit 으로 합친다).
- 절차 전체는 skill: `infra-change` / `env-var` / `hotfix`.
