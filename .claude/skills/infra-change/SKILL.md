---
name: infra-change
description: infra/ Terraform(shared 또는 env dev/prod)을 바꿀 때. fmt·validate·plan 을 PR 본문에 요약, apply 는 인프라 담당이 로컬에서. destroy 금지, 리전 고정.
---
# 인프라 변경

**누가**: 인프라 담당(AWS SSO 보유자)이 apply. 개발자는 PR 로 제안할 수 있다(`infra/**` PR 은 `infra` 워크플로가 fmt/validate 를 돈다). 규칙: `.claude/rules/infra.md`, `docs/conventions/cicd-and-ops.md`.

## 순서
1. `infra/GFM-n-<slug>` 브랜치. `infra/shared`(계정 공통: OIDC·ECR·Route53·ACM·VPC·ALB·ECS 클러스터) 또는 `infra/env`(환경별: 서비스·RDS·S3·SSM·로그) 수정. 리전 변수는 바꾸지 않는다.
2. `terraform fmt` → `terraform validate` → `terraform plan -var-file=dev.tfvars`(env 는 `terraform workspace select dev` 먼저). 결과를 **PR 본문에 요약**(추가/변경/삭제 개수와 대상). Claude 는 plan 까지만 돌리고 apply 는 사람이 승인한다.
3. 병합 후 **dev apply** 는 둘 중 하나. (a) 담당자 로컬: `aws sso login --profile gforest --use-device-code` → `terraform workspace select dev && terraform apply -var-file=dev.tfvars`. (b) 원격 제어 세션: `infra/env/apply.sh dev plan` 으로 요약을 보여주고 → 사용자가 읽고 "apply" 라고 지시하면 → `infra/env/apply.sh dev apply`(저장된 plan 파일만 적용, 15분 지나면 거부). 지시 없이 apply 단계를 돌리지 않는다. 허용 규칙은 담당자 개인 `.claude/settings.local.json`(`Bash(infra/env/apply.sh dev plan)`·`Bash(infra/env/apply.sh dev apply)`) — 공유 settings 에는 넣지 않는다. **prod 는 (a) 만** — 릴리스와 별개로 담당자가 시점을 정해 로컬에서(현재 prod 는 준비만, `PROD_ENABLED=false`).
4. 비용이 붙는 리소스는 Budgets `gforest-monthly`(월 USD 110) 와 Confluence "AWS 구성 현황" 페이지에 반영한다.
5. Confluence 05 운영 > AWS 구성 현황 페이지가 미러다 — 사양·월 비용이 바뀌면 같이 갱신.

## 하지 말 것
- 콘솔에서 리소스 만들기(Terraform 밖 = 존재하지 않는 것으로 취급).
- 장기 액세스 키 생성, root 로그인.
- `terraform destroy`. `terraform apply` 를 plan 확인 없이.
- RDS 비상 개방(`db_publicly_accessible=true` + 본인 IP)을 켜 둔 채 퇴근하기 — 작업 후 **즉시** 되돌린다.
