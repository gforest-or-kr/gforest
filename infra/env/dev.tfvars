host          = "dev.gforest.or.kr"
cpu           = 256
memory        = 512
desired_count = 1
image_tag     = "dev-latest"
use_spot      = true

environment = {
  NEXT_PUBLIC_SITE_URL = "https://dev.gforest.or.kr"
}
