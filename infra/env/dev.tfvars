host          = "dev.gforest.or.kr"
cpu           = 256
memory        = 512
desired_count = 1
image_tag     = "dev-latest"
use_spot      = true

environment = {
  NEXT_PUBLIC_SITE_URL = "https://dev.gforest.or.kr"
  MEDIA_BUCKET         = "gforest-media-dev-106360388338"
  AWS_REGION           = "ap-northeast-2"
}

secret_parameters = {
  DATABASE_URL = "/gforest/dev/DATABASE_URL"
  AUTH_SECRET  = "/gforest/dev/AUTH_SECRET"
}

# 이관 작업 동안 홈 맥북에서 직접 접속 (작업 후 false로)
db_publicly_accessible = true
db_allowed_cidrs       = ["112.168.240.74/32"]
