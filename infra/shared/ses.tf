# SES 발신 도메인 — 비밀번호 재설정 등 트랜잭션 메일을 noreply@gforest.or.kr 로 보내기 위한 도메인 검증(DKIM).
# 검증 CNAME 3개는 Route 53 존에도 넣지만(NS 전환 뒤 유효), 컷오버 전에는 cafe24 DNS 에 사람이 같은 값을 넣어야 한다
#   → `terraform output ses_dns_records`
# 새 계정의 SES 는 샌드박스(검증한 수신자에게만 발송, 하루 200통). 회원 전체 발송은 콘솔에서 "프로덕션 액세스" 신청(사용자).

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# DMARC: 처음엔 p=none(모니터링만). 리포트는 공용 Gmail 로.
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:gforest.or.kr+dmarc@gmail.com"]
}

output "ses_identity_arn" { value = aws_sesv2_email_identity.domain.arn }

output "ses_dns_records" {
  description = "컷오버 전 cafe24 DNS 에 추가할 레코드 (DKIM CNAME 3 + DMARC TXT 1)"
  value = concat(
    [for t in aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens :
    { type = "CNAME", name = "${t}._domainkey", value = "${t}.dkim.amazonses.com" }],
    [{ type = "TXT", name = "_dmarc", value = "v=DMARC1; p=none; rua=mailto:gforest.or.kr+dmarc@gmail.com" }],
  )
}
