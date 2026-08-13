data "archive_file" "next_parameter_set_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/next_parameter_set_monitor.py"
  output_path = "${path.module}/lambda/next_parameter_set_monitor.zip"
}

resource "aws_dynamodb_table" "participant" {
  name         = "${local.resource_name_prefix}-participant"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = var.tags
}

resource "aws_iam_role" "next_parameter_set_lambda" {
  name = "${local.resource_name_prefix}-next-parameter-set-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "next_parameter_set_lambda_basic" {
  role       = aws_iam_role.next_parameter_set_lambda.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "next_parameter_set_lambda" {
  name = "${local.resource_name_prefix}-next-parameter-set-policy"
  role = aws_iam_role.next_parameter_set_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.participant.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = "arn:${data.aws_partition.current.partition}:sagemaker:${var.aws_region}:${data.aws_caller_identity.current.account_id}:endpoint/${var.sagemaker_endpoint_name}"
      }
    ]
  })
}

resource "aws_lambda_function" "next_parameter_set_monitor" {
  function_name    = "${local.resource_name_prefix}-next-parameter-set-monitor"
  role             = aws_iam_role.next_parameter_set_lambda.arn
  runtime          = "python3.12"
  handler          = "next_parameter_set_monitor.handler"
  filename         = data.archive_file.next_parameter_set_lambda.output_path
  source_code_hash = data.archive_file.next_parameter_set_lambda.output_base64sha256
  timeout          = 120

  environment {
    variables = {
      PARTICIPANT_TABLE_NAME  = aws_dynamodb_table.participant.name
      SAGEMAKER_ENDPOINT_NAME = var.sagemaker_endpoint_name
    }
  }

  tags = var.tags
}

resource "aws_appsync_graphql_api" "api" {
  name                = "${local.resource_name_prefix}-api"
  authentication_type = "API_KEY"
  schema              = file("${path.module}/graphql/schema.graphql")

  tags = var.tags
}

resource "aws_appsync_api_key" "api_key" {
  api_id = aws_appsync_graphql_api.api.id
}

resource "aws_iam_role" "appsync_ddb_role" {
  name = "${local.resource_name_prefix}-appsync-ddb-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "appsync.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "appsync_ddb_role" {
  name = "${local.resource_name_prefix}-appsync-ddb-policy"
  role = aws_iam_role.appsync_ddb_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.participant.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "appsync_lambda_role" {
  name = "${local.resource_name_prefix}-appsync-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "appsync.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "appsync_lambda_role" {
  name = "${local.resource_name_prefix}-appsync-lambda-policy"
  role = aws_iam_role.appsync_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.next_parameter_set_monitor.arn,
          "${aws_lambda_function.next_parameter_set_monitor.arn}:*"
        ]
      }
    ]
  })
}

resource "aws_appsync_datasource" "participant" {
  api_id           = aws_appsync_graphql_api.api.id
  name             = "ParticipantTable"
  type             = "AMAZON_DYNAMODB"
  service_role_arn = aws_iam_role.appsync_ddb_role.arn

  dynamodb_config {
    table_name = aws_dynamodb_table.participant.name
  }
}

resource "aws_appsync_datasource" "next_parameter_set_lambda" {
  api_id           = aws_appsync_graphql_api.api.id
  name             = "NextParameterSetLambda"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_lambda_role.arn

  lambda_config {
    function_arn = aws_lambda_function.next_parameter_set_monitor.arn
  }
}

resource "aws_lambda_permission" "allow_appsync" {
  statement_id  = "AllowExecutionFromAppSync"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.next_parameter_set_monitor.function_name
  principal     = "appsync.amazonaws.com"
  source_arn    = "${aws_appsync_graphql_api.api.arn}/*"
}

resource "aws_appsync_resolver" "query_list_participants" {
  api_id      = aws_appsync_graphql_api.api.id
  type        = "Query"
  field       = "listParticipants"
  data_source = aws_appsync_datasource.participant.name

  request_template  = file("${path.module}/resolvers/Query.listParticipants.req.vtl")
  response_template = file("${path.module}/resolvers/Query.listParticipants.res.vtl")
}

resource "aws_appsync_resolver" "mutation_create_participant" {
  api_id      = aws_appsync_graphql_api.api.id
  type        = "Mutation"
  field       = "createParticipant"
  data_source = aws_appsync_datasource.participant.name

  request_template  = file("${path.module}/resolvers/Mutation.createParticipant.req.vtl")
  response_template = file("${path.module}/resolvers/Mutation.createParticipant.res.vtl")
}

resource "aws_appsync_resolver" "mutation_update_participant" {
  api_id      = aws_appsync_graphql_api.api.id
  type        = "Mutation"
  field       = "updateParticipant"
  data_source = aws_appsync_datasource.participant.name

  request_template  = file("${path.module}/resolvers/Mutation.updateParticipant.req.vtl")
  response_template = file("${path.module}/resolvers/Mutation.updateParticipant.res.vtl")
}

resource "aws_appsync_resolver" "mutation_append_participant_attempt_block" {
  api_id      = aws_appsync_graphql_api.api.id
  type        = "Mutation"
  field       = "appendParticipantAttemptBlock"
  data_source = aws_appsync_datasource.participant.name

  request_template  = file("${path.module}/resolvers/Mutation.appendParticipantAttemptBlock.req.vtl")
  response_template = file("${path.module}/resolvers/Mutation.appendParticipantAttemptBlock.res.vtl")
}

resource "aws_appsync_resolver" "mutation_trigger_next_parameter_set" {
  api_id      = aws_appsync_graphql_api.api.id
  type        = "Mutation"
  field       = "triggerNextParameterSet"
  data_source = aws_appsync_datasource.next_parameter_set_lambda.name

  request_template  = file("${path.module}/resolvers/Mutation.triggerNextParameterSet.req.vtl")
  response_template = file("${path.module}/resolvers/Mutation.triggerNextParameterSet.res.vtl")
}
