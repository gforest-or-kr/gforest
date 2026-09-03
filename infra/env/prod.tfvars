host          = "gforest.or.kr"
cpu           = 512
memory        = 1024
desired_count = 2
image_tag     = "prod-latest"
use_spot      = false

environment = {
  NEXT_PUBLIC_SITE_URL = "https://gforest.or.kr"
}
