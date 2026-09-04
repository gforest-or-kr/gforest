# GitHub Actions → AWS 배포용 OIDC 신뢰. 장기 액세스 키를 GitHub에 저장하지 않는다.
# 신뢰 조건: gforest-or-kr/gforest 저장소의 main 브랜치 push 또는 PR 워크플로만.
# sub 클레임은 GitHub의 ID 포함 형식(repo:<owner>@<owner_id>/<repo>@<repo_id>:...)을 따른다.

data "aws_caller_identity" "current" {}

locals {
  github_owner     = split("/", var.github_repo)[0]
  github_repo_name = split("/", var.github_repo)[1]
  github_repo_sub  = "${local.github_owner}@${var.github_owner_id}/${local.github_repo_name}@${var.github_repo_id}"
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # GitHub OIDC는 2023-07부터 AWS가 인증서 체인을 직접 검증하므로 thumbprint는 형식상 값
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${local.github_repo_sub}:ref:refs/heads/main",
        "repo:${local.github_repo_sub}:pull_request",
        "repo:${local.github_repo_sub}:environment:*",
      ]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.app_name}-github-deploy"
  description        = "GitHub Actions deploy role (ECR push + ECS service update)"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

# 배포에 필요한 최소 권한. ECS 서비스/태스크 정의 ARN은 4-2에서 생성되므로
# 지금은 리소스 접두어(gforest-*)로 범위를 좁힌다.
data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.web.arn]
  }

  statement {
    sid = "EcsDeploy"
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
      "ecs:RegisterTaskDefinition",
      "ecs:RunTask", # 배포 전 DB 마이그레이션 일회성 태스크
      "ecs:UpdateService",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "MigrationLogs" # 마이그레이션 태스크의 출력을 워크플로 로그에 그대로 보여주기 위해
    actions   = ["logs:GetLogEvents"]
    resources = ["arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${var.app_name}-*:*"]
  }

  statement {
    sid     = "PassTaskRoles"
    actions = ["iam:PassRole"]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.app_name}-*",
    ]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
