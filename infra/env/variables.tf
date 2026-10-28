# 워크스페이스별 값은 dev.tfvars / prod.tfvars 로 넘긴다:
#   terraform workspace select dev && terraform apply -var-file=dev.tfvars

variable "host" {
  description = "이 환경이 응답할 호스트명 (ALB 호스트 기반 라우팅)"
  type        = string
}

variable "alias_hosts" {
  description = "같은 서비스로 보낼 추가 호스트명 (컷오버 후 prod 의 www.gforest.or.kr 등)"
  type        = list(string)
  default     = []
}

variable "cpu" {
  description = "Fargate vCPU 단위 (256 = 0.25 vCPU)"
  type        = number
}

variable "memory" {
  description = "Fargate 메모리 MiB"
  type        = number
}

variable "desired_count" {
  type = number
}

variable "image_tag" {
  description = "ECR 이미지 태그. 배포 워크플로가 새 태스크 정의로 덮어쓰므로 여기 값은 초기값/복구용"
  type        = string
}

variable "environment" {
  description = "컨테이너 평문 환경변수 (비밀값 금지 — 비밀값은 secret_parameters)"
  type        = map(string)
  default     = {}
}

variable "secret_parameters" {
  description = "환경변수명 => SSM SecureString 파라미터 이름 (/gforest/<env>/... ). 값은 콘솔/CLI로 넣는다"
  type        = map(string)
  default     = {}
}

variable "use_spot" {
  description = "FARGATE_SPOT 사용 여부 (dev 권장, prod 금지)"
  type        = bool
  default     = false
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_backup_retention_days" {
  description = "RDS 자동 백업 보존 일수(0~35). prod 7. dev 는 평소 1, 실제 데이터를 받는 동안(설문 등) 30"
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_retention_days >= 0 && var.db_backup_retention_days <= 35
    error_message = "0~35 사이여야 한다."
  }
}

variable "db_deletion_protection" {
  description = "RDS 삭제 보호. prod true. dev 는 실제 데이터를 받는 동안 true(끄려면 tfvars 를 바꿔 apply 한 뒤에야 destroy 가능)"
  type        = bool
  default     = true
}

variable "db_final_snapshot" {
  description = "인스턴스 삭제 시 최종 스냅샷(<name>-final)을 남길지. prod true. dev 는 실제 데이터를 받는 동안 true"
  type        = bool
  default     = true
}

variable "db_publicly_accessible" {
  description = "비상 DB 접근(공개 엔드포인트 + 허용 CIDR). 평소 false. 켰으면 작업 직후 되돌린다"
  type        = bool
  default     = false
}

variable "db_allowed_cidrs" {
  description = "db_publicly_accessible=true 일 때 허용할 CIDR 목록"
  type        = list(string)
  default     = []
}
