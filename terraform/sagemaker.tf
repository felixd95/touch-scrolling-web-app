locals {
  sagemaker_container_image = length(trimspace(var.sagemaker_container_image)) > 0 ? var.sagemaker_container_image : "${var.sagemaker_dlc_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/pytorch:2.13.0-cpu-amzn2023-sagemaker"
  sagemaker_model_key        = "models/active-learning-endpoint/model.tar.gz"

  # bucket_name_prefix already ends in "-"; strip it so we don't end up with
  # double dashes when composing other resource names from it.
  sagemaker_name_root = trimsuffix(local.bucket_name_prefix, "-")

  # aws_sagemaker_endpoint_configuration.name_prefix has a hard 37-character
  # limit (AWS appends a 26-char random suffix, total endpoint config names
  # are capped at 63), so this must stay short and fixed regardless of how
  # long var.project_name is.
  sagemaker_endpoint_config_prefix = "${local.sagemaker_name_root}-al-cfg-"
}

# Packages sagemaker/active-learning-endpoint/code/{inference.py,requirements.txt}
# into a model.tar.gz with the "code/" layout SageMaker's inference toolkit
# expects. Rebuilt automatically on every `terraform apply` whenever either
# file changes, so the deployed endpoint always matches the committed code.
data "archive_file" "sagemaker_model" {
  type        = "tar.gz"
  output_path = "${path.module}/../sagemaker/active-learning-endpoint/model.tar.gz"

  source {
    content  = file("${path.module}/../sagemaker/active-learning-endpoint/code/inference.py")
    filename = "code/inference.py"
  }

  source {
    content  = file("${path.module}/../sagemaker/active-learning-endpoint/code/requirements.txt")
    filename = "code/requirements.txt"
  }
}

resource "aws_s3_bucket" "sagemaker_model_artifacts" {
  bucket        = "${local.sagemaker_name_root}-${data.aws_caller_identity.current.account_id}-${var.aws_region}-sagemaker"
  force_destroy = true

  tags = var.tags
}

resource "aws_s3_bucket_ownership_controls" "sagemaker_model_artifacts" {
  bucket = aws_s3_bucket.sagemaker_model_artifacts.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "sagemaker_model_artifacts" {
  bucket = aws_s3_bucket.sagemaker_model_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "sagemaker_model_artifacts" {
  bucket = aws_s3_bucket.sagemaker_model_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_object" "sagemaker_model" {
  bucket = aws_s3_bucket.sagemaker_model_artifacts.id
  key    = local.sagemaker_model_key
  source = data.archive_file.sagemaker_model.output_path
  etag   = data.archive_file.sagemaker_model.output_md5

  tags = var.tags
}

resource "aws_iam_role" "sagemaker_execution" {
  name = "${local.resource_name_prefix}-sagemaker-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "sagemaker_execution" {
  name = "${local.resource_name_prefix}-sagemaker-execution-policy"
  role = aws_iam_role.sagemaker_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.sagemaker_model_artifacts.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.sagemaker_model_artifacts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/sagemaker/*"
      },
      {
        # Required to pull the AWS Deep Learning Containers image, which is
        # hosted in a separate AWS-owned ECR account (var.sagemaker_dlc_account_id),
        # not this account's own registry.
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = "arn:${data.aws_partition.current.partition}:ecr:${var.aws_region}:${var.sagemaker_dlc_account_id}:repository/*"
      },
      {
        # GetAuthorizationToken has no resource-level permissions; it must be
        # granted on "*".
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_sagemaker_model" "active_learning" {
  execution_role_arn = aws_iam_role.sagemaker_execution.arn

  primary_container {
    image          = local.sagemaker_container_image
    model_data_url = "s3://${aws_s3_bucket.sagemaker_model_artifacts.bucket}/${aws_s3_object.sagemaker_model.key}"

    environment = {
      SAGEMAKER_PROGRAM             = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY    = "/opt/ml/model/code"
      SAGEMAKER_CONTAINER_LOG_LEVEL = "20"
      SAGEMAKER_REGION              = var.aws_region
    }
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_sagemaker_endpoint_configuration" "active_learning" {
  name_prefix = local.sagemaker_endpoint_config_prefix

  # Serverless Inference: no instance runs idle between requests (billed only
  # for the compute actually used per invocation), which fits an experiment
  # that gets triggered occasionally rather than needing an always-on host.
  production_variants {
    variant_name = "AllTraffic"
    model_name   = aws_sagemaker_model.active_learning.name

    serverless_config {
      max_concurrency   = var.sagemaker_serverless_max_concurrency
      memory_size_in_mb = var.sagemaker_serverless_memory_size_mb
    }
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_sagemaker_endpoint" "active_learning" {
  name                 = var.sagemaker_endpoint_name
  endpoint_config_name = aws_sagemaker_endpoint_configuration.active_learning.name

  tags = var.tags

  # SageMaker's DeleteEndpoint API returns before the endpoint is fully gone.
  # If Terraform needs to destroy-and-recreate this resource (e.g. it was
  # tainted by a failed create), a CreateEndpoint call issued immediately
  # after can fail with "Cannot create already existing endpoint" because
  # the deletion is still propagating. Block until AWS confirms the old
  # endpoint is actually deleted before Terraform moves on to (re-)create it.
  provisioner "local-exec" {
    when    = destroy
    command = "aws sagemaker wait endpoint-deleted --endpoint-name ${self.name} --region ${var.aws_region} || true"
  }
}
