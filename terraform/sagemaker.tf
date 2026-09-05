locals {
  # The inference backend uses BoTorch + qLogNEHVI and therefore requires
  # torch at runtime. Use the prebuilt SageMaker PyTorch inference image by
  # default to avoid installing the full torch stack inside a scikit-learn
  # container at cold start.
  sagemaker_container_image = length(trimspace(var.sagemaker_container_image)) > 0 ? var.sagemaker_container_image : data.aws_sagemaker_prebuilt_ecr_image.pytorch.registry_path
  sagemaker_model_key       = "models/active-learning-endpoint/model.tar.gz"

  # bucket_name_prefix already ends in "-"; strip it so we don't end up with
  # double dashes when composing other resource names from it.
  sagemaker_name_root = trimsuffix(local.bucket_name_prefix, "-")

  # aws_sagemaker_endpoint_configuration.name_prefix has a hard 37-character
  # limit (AWS appends a 26-char random suffix, total endpoint config names
  # are capped at 63), so this must stay short and fixed regardless of how
  # long var.project_name is.
  sagemaker_endpoint_config_prefix = "${local.sagemaker_name_root}-al-cfg-"
}

# Resolves the registry path of AWS's official prebuilt SageMaker PyTorch
# inference image.
data "aws_sagemaker_prebuilt_ecr_image" "pytorch" {
  repository_name = "pytorch-inference"
  image_tag       = var.sagemaker_pytorch_image_tag
  region          = var.aws_region
}



# Packages sagemaker/active-learning-endpoint/code/{inference.py,requirements.txt}
# into a model.tar.gz with the "code/" layout SageMaker's inference toolkit
# expects. Rebuilt automatically on every `terraform apply` whenever either
# file changes, so the deployed endpoint always matches the committed code.
data "archive_file" "sagemaker_model" {
  type        = "tar.gz"
  output_path = "${path.module}/../sagemaker/active-learning-endpoint/model.tar.gz"

  # Force world-readable (0644) permissions on every file inside model.tar.gz.
  # Without this, archive_file's inline-content sources produce tar entries
  # with owner-only permission bits. Inside the SageMaker container the model
  # is extracted as root, but the serving process runs as a NON-root user, so
  # it hits "[Errno 13] Permission denied" when the inference toolkit does
  # shutil.copytree('/opt/ml/model/code', '/opt/ml/code') at startup - which
  # crashed the model process ("model process exited") on EVERY image and code
  # version, independent of the ML logic.
  output_file_mode = "0644"

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
        # Required to pull AWS-hosted SageMaker prebuilt inference images.
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = "arn:${data.aws_partition.current.partition}:ecr:${var.aws_region}:*:repository/*"
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

  # Provisioned endpoint to provide more stable compute capacity for BoTorch
  # optimization workloads that can exceed serverless worker time budgets.
  production_variants {
    variant_name = "AllTraffic"
    model_name   = aws_sagemaker_model.active_learning.name
    instance_type = var.sagemaker_instance_type
    initial_instance_count = var.sagemaker_instance_count
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
  # NOTE: destroy-time provisioners may only reference 'self', so the region
  # is not passed explicitly here; the AWS CLI picks it up from the
  # AWS_REGION/AWS_DEFAULT_REGION environment variable set by the CI job.
  provisioner "local-exec" {
    when    = destroy
    command = "aws sagemaker wait endpoint-deleted --endpoint-name ${self.name} || true"
  }
}
