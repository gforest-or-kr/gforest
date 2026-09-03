resource "aws_ecs_cluster" "main" {
  name = var.app_name

  setting {
    name  = "containerInsights"
    value = "disabled" # 비용 절감. 필요 시 enhanced로
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# 태스크 실행 롤(ECR pull, 로그, SSM 파라미터 읽기) — env 스택이 공유
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.app_name}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_ssm" {
  statement {
    actions   = ["ssm:GetParameters", "ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/*"]
  }
}

resource "aws_iam_role_policy" "task_execution_ssm" {
  name   = "read-app-parameters"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_ssm.json
}
