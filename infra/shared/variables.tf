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
