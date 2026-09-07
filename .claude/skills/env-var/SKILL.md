---
name: env-var
description: 환경변수·비밀값을 추가할 때. 평문은 tfvars + .env.local.example, 비밀값은 SSM /gforest/<env>/<NAME> + secret_parameters 이름만. 값을 코드·채팅에 쓰지 않는다.
---
# 환경변수·비밀값 추가

## 평문 값 (URL, 버킷 이름, 플래그)
1. `infra/env/dev.tfvars`·`prod.tfvars` 의 `environment` 에 추가.
2. `.env.local.example` 에도 추가(로컬 기본값).
3. 코드에서는 `process.env.X`, 없을 때 기본값을 둔다.
4. 인프라 담당이 `terraform apply` → 다음 배포부터 반영(워크플로가 최신 태스크 정의를 복제한다). 개발자는 PR 본문에 "tfvars 변경 → apply 필요" 를 남긴다.

## 비밀값 (토큰, 키)
- 코드·tfvars·`.env.local.example` 에 **값을 쓰지 않는다.**
- 인프라 담당이 SSM `/gforest/<env>/<NAME>` 에 넣고 `infra/env/*.tfvars` 의 `secret_parameters` 에 **이름만** 추가 → apply.
- 로컬은 `.env.local` 에 본인 값(커밋 금지).
- 채팅에 붙여넣은 키는 오염된 것으로 보고 로테이션한다.

## 빌드 시점에 필요한 값 (`NEXT_PUBLIC_*`)
`ecs-deploy.yml` 의 build-args 로 넘겨야 한다 — 드물다. 필요하면 인프라 담당과 PR.

## 확인
배포 후 태스크 정의(Actions 로그의 register-task-definition)에 이름이 있는지, 앱 동작으로 값이 읽히는지.
