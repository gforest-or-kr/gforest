# 도메인·인증서. Route 53 존은 미리 만들어 두되, 네임서버 전환(cafe24 → Route 53)은
# 서비스 전환 시점(4-4)에 별도로 한다. 그 전까지 이 존은 트래픽에 영향이 없다.

variable "domain" {
  description = "서비스 루트 도메인"
  type        = string
  default     = "gforest.or.kr"
}

# CloudFront 인증서는 us-east-1에만 붙일 수 있다.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "gforest-web"
      ManagedBy = "terraform"
      Stack     = "shared"
    }
  }
}

resource "aws_route53_zone" "main" {
  name    = var.domain
  comment = "gforest.or.kr - NS 전환 전까지 비활성(cafe24가 권한 DNS)"
}

# ALB용 (서울) — gforest.or.kr + *.gforest.or.kr
resource "aws_acm_certificate" "alb" {
  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# CloudFront용 (버지니아) — 같은 도메인이라 검증 CNAME은 서울 것과 동일
resource "aws_acm_certificate" "cloudfront" {
  provider                  = aws.us_east_1
  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# 검증 레코드를 Route 53 존에도 넣어둔다 — NS 전환 후 갱신(자동 재검증)이 끊기지 않게.
# 지금은 cafe24 DNS가 권한이므로, 같은 레코드를 cafe24 패널에 수동 추가해야 검증된다.
resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.alb.domain_validation_options :
    dvo.domain_name => { name = dvo.resource_record_name, type = dvo.resource_record_type, value = dvo.resource_record_value }
  }

  zone_id         = aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 300
  records         = [each.value.value]
  allow_overwrite = true
}
