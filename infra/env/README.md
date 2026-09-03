# infra/env — 환경별(dev/prod) 리소스

Terraform 워크스페이스로 dev/prod를 나눈다. 공통 자원(VPC·ALB·클러스터·ECR)은 `../shared` 상태를 참조.

| 파일 | 내용 |
|---|---|
| `service.tf` | ECS 태스크 정의·서비스(Fargate ARM64), 타깃 그룹, ALB 호스트 규칙, 로그 그룹, 태스크 롤 |
| `dev.tfvars` / `prod.tfvars` | 크기·호스트·이미지 태그·평문 환경변수 (커밋 대상, 비밀값 금지) |

## 실행

```sh
cd infra/env
AWS_PROFILE=gforest terraform init
AWS_PROFILE=gforest terraform workspace select -or-create dev
AWS_PROFILE=gforest terraform apply -var-file=dev.tfvars
```

- 비밀값은 SSM Parameter Store `/gforest/<env>/<NAME>` (SecureString)에 CLI로 넣고 `secret_parameters`로 매핑한다.
- 이미지 태그·태스크 정의는 배포 워크플로가 갱신한다 (`ignore_changes`). Terraform은 초기 생성·구조 변경만.
