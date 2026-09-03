# infra/shared — 환경 공통 리소스

dev/prod가 함께 쓰는 리소스. 상태는 S3 `gforest-tfstate-106360388338` (`shared/terraform.tfstate`).

| 파일 | 내용 |
|---|---|
| `github_oidc.tf` | GitHub Actions OIDC 공급자 + 배포 롤 (`gforest-or-kr/gforest`만 신뢰) |
| `ecr.tf` | 컨테이너 이미지 저장소 `gforest/web` + 수명주기(최근 20개) |

## 실행

```sh
aws sso login --profile gforest      # 8시간 임시 자격증명
cd infra/shared
AWS_PROFILE=gforest terraform init
AWS_PROFILE=gforest terraform plan
AWS_PROFILE=gforest terraform apply
```

- 리전은 서울(ap-northeast-2) 고정. 변수로 바꾸지 말 것 — DB·앱 리전 불일치는 전 페이지 지연의 원인.
- 장기 액세스 키는 어디에도 만들지 않는다. 사람은 Identity Center(SSO), CI는 OIDC 롤.
