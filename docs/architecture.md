# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS                                    │
│          Browser (Admin / Síndico / Morador)                    │
└─────────────────────┬───────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFRONT (CDN)                             │
│         Cache global + HTTPS + WAF + DDoS protection            │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌───────────────────────┐
│   S3 (Frontend)  │      │   API GATEWAY (HTTP)  │
│  HTML + CSS + JS │      │   REST routes + CORS  │
│  Single Page App │      │   Throttling + JWT    │
└──────────────────┘      └───────────┬───────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   AWS LAMBDA (Node.js)  │
                          │   Business logic        │
                          └────────────┬────────────┘
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
               ▼                       ▼                       ▼
┌──────────────────────┐  ┌────────────────────┐  ┌───────────────────┐
│   DynamoDB           │  │   S3 (Files)       │  │   Cognito         │
│   Single-table       │  │   PDFs + JSON      │  │   Auth + JWT      │
│   (On-Demand)        │  │   Presigned URLs   │  │   3 user groups   │
└──────────────────────┘  └────────────────────┘  └───────────────────┘
```

## AWS Services and Responsibilities

### S3 + CloudFront — Frontend Hosting

- S3 bucket stores the SPA (index.html, JS, CSS, assets)
- CloudFront distributes globally with HTTPS (ACM certificate, free)
- WAF optional: OWASP Top 10 rules, rate limiting (~$5/month fixed cost)
- Cache: long TTL for static assets, short TTL for index.html

### Cognito — Authentication

- User Pool with `SelfSignUpEnabled=false` (admin creates users)
- 3 groups: `admin-master`, `sindicos`, `moradores`
- Custom attributes on JWT:
  - `custom:condoId` — for moradores (single condo)
  - `custom:condoIds` — for síndicos (comma-separated list)
  - `custom:role` — injected via pre-token-generation Lambda trigger
- JWT: AccessToken (1h) + RefreshToken (30 days)
- MFA: optional TOTP (recommended for admin and síndico)
- Free tier: up to 50,000 MAU

### API Gateway HTTP API — Routing

- HTTP API (71% cheaper than REST API, lower latency)
- Cognito JWT authorizer on all routes except `/auth/*`
- CORS configured for CloudFront distribution origin
- Throttling: default 10,000 req/s (more than enough)

### Lambda — Business Logic

7 functions, one per domain:

| Function | Responsibility | Memory | Timeout |
|----------|---------------|--------|---------|
| lambda-auth | Login, password change | 256MB | 10s |
| lambda-condominios | Condo CRUD | 256MB | 10s |
| lambda-unidades | Unit CRUD + eligibility | 256MB | 10s |
| lambda-vagas | Spot CRUD + reservations | 256MB | 10s |
| lambda-preferenciais | Preferential assignment + audit | 256MB | 10s |
| lambda-sorteio | Lottery logic + Fisher-Yates | 256MB | 15s |
| lambda-exportacao | PDF generation + JSON export/import | 512MB | 30s |

### DynamoDB — Database

Single-table design, On-Demand billing (no minimum charge).

See [data-model.md](data-model.md) for full key schema.

### S3 (Files) — Document Storage

- PDFs and JSON exports stored with private access
- Accessed only via presigned URLs (expire in 15 minutes)
- Versioning enabled
- Lifecycle: archive to S3 Glacier after 90 days

## Security Layers

| Layer | Controls |
|-------|---------|
| Network | CloudFront WAF, HTTPS everywhere, API Gateway throttling |
| Auth | Cognito JWT, short token expiry (1h), optional MFA |
| Authorization | Lambda checks JWT claims, condoId ownership validated server-side |
| Data | DynamoDB + S3 accessed only via Lambda (no public access), KMS encryption at rest |
| Audit | CloudTrail (all AWS actions), CloudWatch Logs (Lambda), DynamoDB Streams (data changes) |

## CDK Stack Dependency Graph

```
AuthStack
    └── DatabaseStack
            └── StorageStack
                    └── ApiStack
                            └── FrontendStack
```

### Stacks

| Stack file | Resources |
|-----------|-----------|
| `auth-stack.ts` | Cognito UserPool, UserPoolClient, Groups, pre-token trigger |
| `database-stack.ts` | DynamoDB table + 3 GSIs, PITR enabled |
| `storage-stack.ts` | S3 exports bucket, versioning, lifecycle rules |
| `api-stack.ts` | API Gateway HTTP API, all 7 Lambda functions, IAM roles |
| `frontend-stack.ts` | S3 SPA bucket, CloudFront OAC, BucketDeployment, env.js injection |

## Cost Estimate

| Service | Monthly cost |
|---------|-------------|
| CloudFront | ~$0.10 |
| S3 (SPA + files) | ~$0.11 |
| API Gateway HTTP | ~$0.35 |
| Lambda | ~$0.00 (free tier) |
| DynamoDB On-Demand | ~$1.50 |
| Cognito | ~$0.00 (free tier) |
| CloudWatch | ~$0.50 |
| EventBridge | ~$0.00 (free tier) |
| **Subtotal (no WAF)** | **~$2.56/month** |
| WAF (optional) | +~$5.00 |
| **Total (with WAF)** | **~$7.56/month** |
