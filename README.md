# Sistema de Sorteio de Vagas de Garagem

Multi-condo parking spot lottery system built on AWS serverless infrastructure.

## Overview

A web-based SPA for managing and drawing parking spots in residential condos. Designed for three user roles:

- **Admin Master** — global, manages all condos
- **Síndico (Manager)** — multi-condo, manages eligibility, preferential spots, and runs lotteries
- **Morador (Resident)** — read-only, views lottery results for their unit

## Architecture

```
Browser (SPA)
     │ HTTPS
     ▼
CloudFront (CDN + WAF)
     │                │
     ▼                ▼
S3 (Frontend)    API Gateway (HTTP)
                      │
                   Lambda (Node.js)
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      DynamoDB    S3 (Files)   Cognito
  (single-table)  (PDFs/JSON)   (Auth)
```

Estimated cost: **~$2.50/month** (without WAF) or **~$7.50/month** (with WAF).

## Project Structure

```
parking-residential/
├── infra/          # AWS CDK TypeScript — infrastructure as code
├── lambdas/        # Lambda functions (Node.js/TypeScript)
├── frontend/       # Plain HTML/CSS/JS SPA (no build step)
├── docs/           # Architecture and data model documentation
└── scripts/        # Operational scripts
```

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | localStorage SPA — fully functional, zero cloud dependency | Planned |
| 2 | AWS migration — CDK stacks + Lambda backend | Planned |
| 3 | Hardening — WAF, alerting, load testing | Planned |

## Quick Start

### Phase 1 (local)
Open `frontend/index.html` directly in the browser. No installation required.

### Phase 2 (AWS)
```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy --all
```

## Docs

- [Architecture](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Lottery Algorithm](docs/lottery-algorithm.md)
- [API Reference](docs/api-reference.md)
