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
