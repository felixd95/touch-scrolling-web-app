# Touch Scrolling Web App

React web app for touch-scrolling experiments with Android-like fling physics and backend-driven parameter updates.

## Stack

- Frontend: React (Create React App)
- API/Backend: AppSync + DynamoDB + Lambda
- Parameter generation: SageMaker endpoint (invoked by Lambda)
- Infrastructure and deployment: Terraform + GitHub Actions (OIDC)

## Current deployment model

This repository is Terraform-first.

- Infrastructure source of truth: [terraform](terraform)
- CI/CD workflows: [.github/workflows](.github/workflows)
- Frontend runtime backend config is generated into [backend_config.json](backend_config.json) and [src/backend_config.json](src/backend_config.json)

## Local development

1. Install dependencies:
	- `npm ci`
2. Start app:
	- `npm start`
3. Run tests:
	- `npm test`

## Build

- `npm run build`

## Terraform deployment

Use the detailed deployment guide in [README_TERRAFORM_GITHUB_DEPLOY.md](README_TERRAFORM_GITHUB_DEPLOY.md).

This project relies on a remote Terraform backend for state storage in CI.

## Notes

- Frontend expects valid AppSync settings in [backend_config.json](backend_config.json) and [src/backend_config.json](src/backend_config.json).
- These files are produced automatically in CI via [scripts/write-backend-config.mjs](scripts/write-backend-config.mjs).
