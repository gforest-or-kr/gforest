variable "region" {
  description = "모든 리소스가 위치할 리전 (서울 고정)"
  type        = string
  default     = "ap-northeast-2"
}

variable "github_repo" {
  description = "GitHub Actions OIDC로 배포를 허용할 저장소 (owner/name)"
  type        = string
  default     = "gforest-or-kr/gforest"
}

variable "app_name" {
  description = "리소스 이름 접두어"
  type        = string
  default     = "gforest"
}

# GitHub OIDC sub 클레임에 포함되는 ID (이름 변경 공격 방지용으로 고정)
variable "github_owner_id" {
  description = "GitHub Organization ID (gh api orgs/<org> --jq .id)"
  type        = number
  default     = 324632415
}

variable "github_repo_id" {
  description = "GitHub 저장소 ID (gh api repos/<owner>/<repo> --jq .id)"
  type        = number
  default     = 1265071773
}
