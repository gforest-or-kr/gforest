terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # 워크스페이스(dev/prod)별로 env/<workspace>/terraform.tfstate 경로에 저장된다.
  backend "s3" {
    bucket               = "gforest-tfstate-106360388338"
    key                  = "env/terraform.tfstate"
    workspace_key_prefix = "env"
    region               = "ap-northeast-2"
    use_lockfile         = true
    encrypt              = true
  }
}

provider "aws" {
  region = "ap-northeast-2"

  default_tags {
    tags = {
      Project     = "gforest-web"
      ManagedBy   = "terraform"
      Stack       = "env"
      Environment = terraform.workspace
    }
  }
}

data "terraform_remote_state" "shared" {
  backend = "s3"
  config = {
    bucket = "gforest-tfstate-106360388338"
    key    = "shared/terraform.tfstate"
    region = "ap-northeast-2"
  }
}

locals {
  env      = terraform.workspace
  app_name = "gforest"
  name     = "${local.app_name}-${local.env}"
  shared   = data.terraform_remote_state.shared.outputs
}
