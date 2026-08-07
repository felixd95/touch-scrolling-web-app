output "terraform_frontend_bucket_name" {
  description = "Terraform-generated S3 bucket name that stores the built frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "terraform_cloudfront_distribution_id" {
  description = "Terraform-generated CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

output "terraform_cloudfront_domain_name" {
  description = "Terraform-generated CloudFront domain for the deployed frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "terraform_github_actions_role_arn" {
  description = "Terraform-generated role ARN to configure in GitHub Actions"
  value       = aws_iam_role.github_actions_deploy.arn
}

output "terraform_appsync_graphql_url" {
  description = "Terraform-generated GraphQL endpoint URL"
  value       = aws_appsync_graphql_api.api.uris["GRAPHQL"]
}

output "terraform_appsync_api_key" {
  description = "Terraform-generated AppSync API key for public API_KEY auth"
  value       = aws_appsync_api_key.api_key.key
  sensitive   = true
}
