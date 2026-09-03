output "github_deploy_role_arn" {
  description = "GitHub Actions 워크플로의 role-to-assume 값"
  value       = aws_iam_role.github_deploy.arn
}

output "ecr_repository_url" {
  description = "docker push 대상"
  value       = aws_ecr_repository.web.repository_url
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "route53_zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "4-4 서비스 전환 시 cafe24 등록기관에 넣을 네임서버"
  value       = aws_route53_zone.main.name_servers
}

output "acm_validation_records" {
  description = "cafe24 DNS 패널에 추가할 검증 CNAME (도메인별 1개, 와일드카드는 루트와 동일)"
  value = {
    for dvo in aws_acm_certificate.alb.domain_validation_options :
    dvo.domain_name => { name = dvo.resource_record_name, type = dvo.resource_record_type, value = dvo.resource_record_value }
  }
}

output "acm_certificate_arn_alb" {
  value = aws_acm_certificate.alb.arn
}

output "acm_certificate_arn_cloudfront" {
  value = aws_acm_certificate.cloudfront.arn
}

# --- env 스택이 참조하는 값 (terraform_remote_state) ---
output "vpc_id" { value = aws_vpc.main.id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "app_security_group_id" { value = aws_security_group.app.id }
output "db_security_group_id" { value = aws_security_group.db.id }
output "alb_arn" { value = aws_lb.main.arn }
output "alb_dns_name" { value = aws_lb.main.dns_name }
output "alb_zone_id" { value = aws_lb.main.zone_id }
output "alb_https_listener_arn" { value = aws_lb_listener.https.arn }
output "ecs_cluster_arn" { value = aws_ecs_cluster.main.arn }
output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
output "task_execution_role_arn" { value = aws_iam_role.task_execution.arn }
