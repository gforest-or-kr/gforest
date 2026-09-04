host          = "gforest.or.kr"
cpu           = 512
memory        = 1024
desired_count = 2
image_tag     = "prod-latest"
use_spot      = false

environment = {
  NEXT_PUBLIC_SITE_URL = "https://gforest.or.kr"
  MEDIA_BUCKET         = "gforest-media-prod-106360388338"
  AWS_REGION           = "ap-northeast-2"
}

secret_parameters = {
  DATABASE_URL = "/gforest/prod/DATABASE_URL"
  AUTH_SECRET  = "/gforest/prod/AUTH_SECRET"
}
