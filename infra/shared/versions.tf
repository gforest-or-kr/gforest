terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # 상태 파일: S3 + 네이티브 락(use_lockfile, TF 1.10+). DynamoDB 불필요.
  backend "s3" {
    bucket       = "gforest-tfstate-106360388338"
    key          = "shared/terraform.tfstate"
    region       = "ap-northeast-2"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "gforest-web"
      ManagedBy = "terraform"
      Stack     = "shared"
    }
  }
}
