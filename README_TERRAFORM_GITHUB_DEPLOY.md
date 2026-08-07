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

## 2) Terraform Remote State

GitHub Actions verwendet einen S3 Backend-Bucket mit DynamoDB Locking für Terraform State.
Die Workflows erstellen den State-Bucket und die Locking-Tabelle automatisch, wenn sie noch nicht existieren.

- Bucket Name: `touch-scrolling-web-app-terraform-state-eu-central-1`
- DynamoDB Table: `touch-scrolling-web-app-terraform-state-locks`

Es sind keine GitHub Secrets für `TF_STATE_BUCKET_NAME` oder `TF_STATE_DYNAMODB_TABLE_NAME` erforderlich.

## 3) Einmaliger Bootstrap (lokal)

Damit GitHub die Rolle annehmen kann, muss die Rolle einmal erstellt werden oder bereits vorhanden sein:

1. Im Ordner [terraform](terraform):
   - terraform init \
     -backend-config="bucket=touch-scrolling-web-app-terraform-state-eu-central-1" \
     -backend-config="key=terraform/terraform.tfstate" \
     -backend-config="region=eu-central-1" \
     -backend-config="dynamodb_table=touch-scrolling-web-app-terraform-state-locks"
   - terraform apply
2. Output terraform_github_actions_role_arn merken.

## 4) GitHub Secret setzen

In GitHub Repository Settings > Secrets and variables > Actions:

- Name: AWS_GITHUB_DEPLOY_ROLE_ARN
- Wert: Output terraform_github_actions_role_arn

## 4) Deploy Pipeline

Workflows:

- [Terraform Plan](.github/workflows/terraform-plan.yml) auf Pull Requests
- [Deploy](.github/workflows/deploy.yml) auf Push nach main

Deploy Workflow macht:

1. Terraform init mit S3 Remote Backend
2. Terraform apply
3. npm ci && npm run build
4. Upload build/ nach S3
5. CloudFront Invalidation

## Outputs

Wichtige Terraform Outputs:

- terraform_frontend_bucket_name
- terraform_cloudfront_distribution_id
- terraform_cloudfront_domain_name
- terraform_github_actions_role_arn
- terraform_appsync_graphql_url

## Hinweise

- Dieses Setup deployed Frontend und Backend vollstaendig ueber Terraform + GitHub Actions.
- Legacy Amplify-Deploypfade sind im Repository entfernt, um Drift zwischen zwei IaC-Quellen zu vermeiden.
