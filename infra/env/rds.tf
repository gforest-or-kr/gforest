# 환경별 RDS Postgres. 단일 AZ, gp3 20GB, 자동 백업 7일.
# 관리자 접속 문자열은 SSM /gforest/<env>/DATABASE_ADMIN_URL (Terraform 관리).
# 앱 접속 문자열 /gforest/<env>/DATABASE_URL 은 RLS가 적용되는 앱 전용 롤로,
# infra/db/bootstrap.sh 가 생성·기록한다 (테이블 소유자=admin은 RLS를 우회하므로 앱에 쓰지 않는다).

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = local.shared.public_subnet_ids
}

resource "aws_db_parameter_group" "pg17" {
  name   = "${local.name}-pg17"
  family = "postgres17"

  # 커넥션 수가 적은 워크로드. 느린 쿼리(>500ms)만 로그.
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "17"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 50 # 자동 확장 상한
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "gforest"
  username = "gforest_admin"
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = concat([local.shared.db_security_group_id], var.db_publicly_accessible ? [aws_security_group.db_public[0].id] : [])
  parameter_group_name   = aws_db_parameter_group.pg17.name
  publicly_accessible    = var.db_publicly_accessible

  multi_az                     = false
  backup_retention_period      = local.env == "prod" ? 7 : 1
  backup_window                = "17:00-18:00" # KST 02:00-03:00
  maintenance_window           = "sun:18:00-sun:19:00"
  deletion_protection          = local.env == "prod"
  skip_final_snapshot          = local.env != "prod"
  final_snapshot_identifier    = local.env == "prod" ? "${local.name}-final" : null
  copy_tags_to_snapshot        = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = false

  lifecycle {
    ignore_changes = [engine_version] # 자동 마이너 업그레이드가 바꾼 값을 되돌리지 않음
  }
}

# 이관·운영 작업용 임시 공개 접근 (dev 또는 컷오버 기간). 허용 CIDR만.
resource "aws_security_group" "db_public" {
  count       = var.db_publicly_accessible ? 1 : 0
  name        = "${local.name}-db-public"
  description = "RDS temporary public access from allowed CIDRs"
  vpc_id      = local.shared.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "db_public" {
  for_each          = var.db_publicly_accessible ? toset(var.db_allowed_cidrs) : toset([])
  security_group_id = aws_security_group.db_public[0].id
  ip_protocol       = "tcp"
  from_port         = 5432
  to_port           = 5432
  cidr_ipv4         = each.value
}

resource "aws_ssm_parameter" "database_admin_url" {
  name  = "/gforest/${local.env}/DATABASE_ADMIN_URL"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}?sslmode=require"
}

output "db_endpoint" { value = aws_db_instance.main.address }
