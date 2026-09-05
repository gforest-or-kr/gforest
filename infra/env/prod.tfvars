# prod — 컷오버(cafe24 → AWS 전환) 전까지는 prod.gforest.or.kr 로 운영한다(안정화·리허설).
# 컷오버 때: host = "gforest.or.kr", alias_hosts = ["www.gforest.or.kr"], NEXT_PUBLIC_SITE_URL, SITE_INDEXABLE = "true",
#            repo 변수 PROD_SITE_URL 도 함께 바꾸고 재배포. apply 는 안정화 단계 진입 시(그때 repo 변수 PROD_ENABLED=true).
host          = "prod.gforest.or.kr"
alias_hosts   = []
cpu           = 512
memory        = 1024
desired_count = 2
image_tag     = "prod-latest"
use_spot      = false

environment = {
  NEXT_PUBLIC_SITE_URL = "https://prod.gforest.or.kr"
  SITE_INDEXABLE       = "false"                 # 정식 도메인이 아닌 동안 검색엔진 차단 (proxy.ts X-Robots-Tag + robots.txt)
  MAIL_FROM            = "noreply@gforest.or.kr" # SES 도메인 검증 + 프로덕션 액세스 승인이 전제
  MEDIA_BUCKET         = "gforest-media-prod-106360388338"
  AWS_REGION           = "ap-northeast-2"
}

secret_parameters = {
  DATABASE_URL = "/gforest/prod/DATABASE_URL"
  AUTH_SECRET  = "/gforest/prod/AUTH_SECRET"
}
