# Deployment Guide — Phase 2 (AWS)

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js 20+
- AWS CDK installed globally: `npm install -g aws-cdk`

## First-time setup

```bash
# 1. Bootstrap CDK in your account (once per account/region)
cd infra
npm install
npx cdk bootstrap aws://ACCOUNT_ID/REGION

# 2. Install Lambda dependencies
cd ../lambdas
npm install
```

## Deploy all stacks

```bash
cd infra
npx cdk deploy --all
```

Stacks deploy in dependency order:
1. `ParkingAuth` — Cognito
2. `ParkingDatabase` — DynamoDB
3. `ParkingStorage` — S3 (files)
4. `ParkingApi` — API Gateway + Lambdas
5. `ParkingFrontend` — S3 + CloudFront

After deploy, CDK outputs:
- `ParkingAppUrl` — the CloudFront URL (your app URL)
- `ParkingApiUrl` — the API Gateway URL
- `ParkingUserPoolId` — Cognito User Pool ID
- `ParkingUserPoolClientId` — Cognito App Client ID

## Create initial users in Cognito

After deploying `ParkingAuth`, create users via AWS CLI:

```bash
POOL_ID=$(aws cloudformation describe-stacks --stack-name ParkingAuth --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

# Create admin master
aws cognito-idp admin-create-user \
  --user-pool-id $POOL_ID \
  --username admin \
  --temporary-password TempPass1! \
  --user-attributes Name=custom:role,Value=admin

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $POOL_ID \
  --username admin \
  --group-name admin-master

# Create a síndico
aws cognito-idp admin-create-user \
  --user-pool-id $POOL_ID \
  --username sindico \
  --temporary-password TempPass1! \
  --user-attributes Name=custom:role,Value=sindico Name=custom:condoIds,Value="CONDO_ID_HERE"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $POOL_ID \
  --username sindico \
  --group-name sindicos
```

## Enable WAF (optional, +$5/month)

Set in `infra/cdk.json`:
```json
{ "context": { "enableWaf": true } }
```
Then redeploy `ParkingFrontend`.

## Switching between Phase 1 and Phase 2

The frontend detects the adapter automatically:
- If `window.__ENV.API_URL` is empty → uses `local-storage-adapter.js` (Phase 1)
- If `window.__ENV.API_URL` is set → uses `api-adapter.js` (Phase 2)

The `env.js` file is auto-written by CDK `FrontendStack` at synth time.
When opening `frontend/index.html` locally (no CloudFront), `env.js` has empty values → Phase 1 runs.

## Tear down

```bash
cd infra
npx cdk destroy --all
```

Note: `ParkingDatabase` and `ParkingAuth` have `RemovalPolicy.RETAIN` — DynamoDB and Cognito are **not deleted** to protect data. Delete manually if truly needed.
