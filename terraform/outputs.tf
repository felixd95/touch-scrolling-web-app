output "frontend_bucket_name" {
  description = "S3 bucket that stores the built frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain for the deployed frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "github_actions_role_arn" {
  description = "Role ARN to configure in GitHub Actions"
  value       = aws_iam_role.github_actions_deploy.arn
}

output "appsync_graphql_url" {
  description = "GraphQL endpoint URL"
  value       = aws_appsync_graphql_api.api.uris["GRAPHQL"]
}

output "appsync_api_key" {
  description = "AppSync API key for public API_KEY auth"
  value       = aws_appsync_api_key.api_key.key
  sensitive   = true
}
