host          = "dev.gforest.or.kr"
cpu           = 256
memory        = 512
desired_count = 1
image_tag     = "dev-latest"
use_spot      = true

environment = {
  NEXT_PUBLIC_SITE_URL = "https://dev.gforest.or.kr"
  SITE_INDEXABLE       = "false" # dev 는 검색엔진 차단
  MEDIA_BUCKET         = "gforest-media-dev-106360388338"
  AWS_REGION           = "ap-northeast-2"
}

secret_parameters = {
  DATABASE_URL = "/gforest/dev/DATABASE_URL"
  AUTH_SECRET  = "/gforest/dev/AUTH_SECRET"
}

# RDS는 비공개가 기본. 비상 시에만 true + 본인 IP/32 로 잠깐 열고 즉시 되돌린다(docs/conventions/cicd-and-ops.md).
db_publicly_accessible = false
db_allowed_cidrs       = []
