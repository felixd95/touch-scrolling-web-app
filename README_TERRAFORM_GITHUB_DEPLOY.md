# Terraform + GitHub Actions Deployment

Dieses Setup stellt Infrastruktur und Backend per Terraform bereit und deployed das Frontend per GitHub Actions via OIDC-Rolle.

## Was wurde definiert

- Terraform in [terraform](terraform)
- GitHub OIDC Provider (optional, konfigurierbar)
- GitHub Deploy Role mit OIDC Trust auf das Repo und den main-Branch
- S3 Bucket fuer Frontend-Artefakte
- CloudFront Distribution (inkl. SPA-Fallback auf index.html)
- AppSync API, DynamoDB Tabellen, Lambda und Resolver
- GitHub Actions Workflows

## Voraussetzungen

- AWS Account mit Berechtigung zum Erstellen von IAM, S3, CloudFront, AppSync, Lambda und DynamoDB
- GitHub Repository mit Actions aktiviert
- Terraform >= 1.6

## 1) Terraform konfigurieren

1. Beispiel kopieren:
   - [terraform/terraform.tfvars.example](terraform/terraform.tfvars.example) nach terraform.tfvars im Ordner [terraform](terraform) kopieren
2. Werte anpassen (Owner, Repo, Branch, Region).
3. Falls in deinem Account bereits ein GitHub OIDC Provider existiert:
   - create_github_oidc_provider = false
   - existing_github_oidc_provider_arn setzen

## 2) Einmaliger Bootstrap (lokal)

Damit GitHub die Rolle annehmen kann, muss die Rolle einmal erstellt werden:

1. Im Ordner [terraform](terraform):
   - terraform init
   - terraform apply
2. Output github_actions_role_arn merken.

## 3) GitHub Secret setzen

In GitHub Repository Settings > Secrets and variables > Actions:

- Name: AWS_GITHUB_DEPLOY_ROLE_ARN
- Wert: Output github_actions_role_arn

## 4) Deploy Pipeline

Workflows:

- [Terraform Plan](.github/workflows/terraform-plan.yml) auf Pull Requests
- [Deploy](.github/workflows/deploy.yml) auf Push nach main

Deploy Workflow macht:

1. Terraform apply
2. npm ci && npm run build
3. Upload build/ nach S3
4. CloudFront Invalidation

## Outputs

Wichtige Terraform Outputs:

- frontend_bucket_name
- cloudfront_distribution_id
- cloudfront_domain_name
- github_actions_role_arn
- appsync_graphql_url

## Hinweise

- Dieses Setup deployed Frontend und Backend vollstaendig ueber Terraform + GitHub Actions.
- Legacy Amplify-Deploypfade sind im Repository entfernt, um Drift zwischen zwei IaC-Quellen zu vermeiden.
