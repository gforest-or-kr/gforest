resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
}

# 앱 컨테이너가 AWS 자원(S3 등)에 접근할 때 쓰는 롤. 4-3에서 S3 권한 추가.
resource "aws_iam_role" "task" {
  name = "${local.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = local.shared.task_execution_role_arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64" # Graviton: x86 대비 ~20% 저렴
  }

  container_definitions = jsonencode([{
    name         = "web"
    image        = "${local.shared.ecr_repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment  = [for k, v in merge({ NODE_ENV = "production", PORT = "3000", HOSTNAME = "0.0.0.0" }, var.environment) : { name = k, value = v }]
    secrets = [for k, p in var.secret_parameters : {
      name      = k
      valueFrom = "arn:aws:ssm:ap-northeast-2:${local.shared.account_id}:parameter${p}"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = "ap-northeast-2"
        awslogs-stream-prefix = "web"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
  }])

  # 역할 분담: 환경변수·시크릿·크기는 Terraform이(새 리비전 등록), 이미지 교체는 배포 워크플로가.
  # 워크플로는 항상 "가장 최근 리비전"을 복제해 이미지만 바꾸므로 여기서 등록한 값이 다음 배포에 반영된다.
}

resource "aws_lb_target_group" "app" {
  name        = local.name
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = local.shared.vpc_id

  deregistration_delay = 15

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener_rule" "app" {
  listener_arn = local.shared.alb_https_listener_arn
  priority     = local.env == "prod" ? 10 : 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    host_header {
      values = local.env == "prod" ? [var.host, "www.${var.host}"] : [var.host]
    }
  }
}

resource "aws_ecs_service" "app" {
  name            = local.name
  cluster         = local.shared.ecs_cluster_arn
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count

  capacity_provider_strategy {
    capacity_provider = var.use_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = local.shared.public_subnet_ids
    security_groups  = [local.shared.app_security_group_id]
    assign_public_ip = true # NAT 없이 ECR/외부 접근
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "web"
    container_port   = 3000
  }

  lifecycle {
    ignore_changes = [task_definition] # 배포 워크플로가 갱신
  }

  depends_on = [aws_lb_listener_rule.app]
}
