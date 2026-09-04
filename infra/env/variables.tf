# 워크스페이스별 값은 dev.tfvars / prod.tfvars 로 넘긴다:
#   terraform workspace select dev && terraform apply -var-file=dev.tfvars

variable "host" {
  description = "이 환경이 응답할 호스트명 (ALB 호스트 기반 라우팅)"
  type        = string
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
