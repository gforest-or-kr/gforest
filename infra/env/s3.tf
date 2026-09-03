# 미디어(첨부·아바타·슬라이드) 버킷. 퍼블릭 차단, CloudFront OAC로만 공개 서빙(4-4).
resource "aws_s3_bucket" "media" {
  bucket = "gforest-media-${local.env}-${local.shared.account_id}"
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration { status = "Disabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 3 }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["https://${var.host}", "http://localhost:3000"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

# 앱 태스크 롤: 이 버킷만 읽기·쓰기·삭제 + presigned URL 발급
data "aws_iam_policy_document" "task_media" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn]
  }
}

resource "aws_iam_role_policy" "task_media" {
  name   = "media-bucket"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_media.json
}

output "media_bucket" { value = aws_s3_bucket.media.bucket }
