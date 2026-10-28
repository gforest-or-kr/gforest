host = "dev.gforest.or.kr"
# portal: 설문 등 사이트 바깥 화면용 호스트 — 같은 dev 서비스, 앱 proxy.ts 가 /portal 아래로만 응답(GFM-98).
# cafe24 DNS 에 CNAME portal → ALB 를 사람이 넣어야 한다(NS 전환 전). 컷오버 때 prod 로 옮기고 여기서 뺀다.
alias_hosts   = ["portal.gforest.or.kr"]
cpu           = 256
memory        = 512
desired_count = 1
image_tag     = "dev-latest"
use_spot      = true

environment = {
  NEXT_PUBLIC_SITE_URL = "https://dev.gforest.or.kr"
  SITE_INDEXABLE       = "false" # dev 는 검색엔진 차단
  # MAIL_FROM = "noreply@gforest.or.kr"  # SES 도메인 검증(DKIM) 완료 후 주석 해제. 없으면 메일은 로그로만(dry-run)
  MEDIA_BUCKET = "gforest-media-dev-106360388338"
  AWS_REGION   = "ap-northeast-2"
}

secret_parameters = {
  DATABASE_URL = "/gforest/dev/DATABASE_URL"
  AUTH_SECRET  = "/gforest/dev/AUTH_SECRET"
}

# RDS는 비공개가 기본. 비상 시에만 true + 본인 IP/32 로 잠깐 열고 즉시 되돌린다(docs/conventions/cicd-and-ops.md).
db_publicly_accessible = false
db_allowed_cidrs       = []
