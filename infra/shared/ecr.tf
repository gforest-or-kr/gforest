# 앱 컨테이너 이미지 저장소. dev/prod 이미지는 태그로 구분(sha, dev-latest, prod-latest).

resource "aws_ecr_repository" "web" {
  name                 = "${var.app_name}/web"
  image_tag_mutability = "MUTABLE" # *-latest 태그를 덮어쓰기 위해
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# 저장 비용 억제: 태그 없는 이미지 1일 후, 태그 이미지는 최근 20개만 유지
resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "untagged: 1일 후 삭제"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "tagged: 최근 20개만 유지"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = 20
        }
        action = { type = "expire" }
      },
    ]
  })
}
