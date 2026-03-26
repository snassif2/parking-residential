# API Reference

Base URL: `https://{api-id}.execute-api.{region}.amazonaws.com`

All routes except `/auth/*` require `Authorization: Bearer {cognito-id-token}` header.

## Auth

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/auth/login` | Any | Authenticate user, returns JWT tokens |
| POST | `/auth/change-password` | Any (self) | Change own password |

## Condominios

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/condominios` | Admin, Síndico | List condos (admin sees all; síndico sees assigned) |
| POST | `/condominios` | Admin | Create condo |
| GET | `/condominios/{id}` | Admin, Síndico | Get condo details |
| PUT | `/condominios/{id}` | Admin, Síndico | Update condo |
| DELETE | `/condominios/{id}` | Admin | Remove condo |

## Unidades

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/condominios/{id}/unidades` | Admin, Síndico, Morador | List all units |
| POST | `/condominios/{id}/unidades` | Admin, Síndico | Create unit |
| PUT | `/condominios/{id}/unidades/{uid}` | Admin, Síndico | Update unit (incl. eligibility) |

## Vagas

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/condominios/{id}/vagas` | Admin, Síndico, Morador | List all spots |
| POST | `/condominios/{id}/vagas` | Admin, Síndico | Create spot |
| PUT | `/condominios/{id}/vagas/{vid}` | Admin, Síndico | Update spot / toggle reservation |

## Preferenciais

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/condominios/{id}/preferenciais` | Admin, Síndico | List preferential assignments |
| POST | `/condominios/{id}/preferenciais` | Admin, Síndico | Create preferential assignment |
| PUT | `/condominios/{id}/preferenciais/{pid}` | Admin, Síndico | Edit assignment (type, dates) |
| DELETE | `/condominios/{id}/preferenciais/{pid}` | Admin, Síndico | Revoke assignment (justification required) |

## Sorteio

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/condominios/{id}/sorteio/preview` | Admin, Síndico | Dry-run summary (counts only, no draw) |
| POST | `/condominios/{id}/sorteio/teste` | Admin, Síndico | Run test lottery (not saved) |
| POST | `/condominios/{id}/sorteio/oficial` | Admin, Síndico | Run official lottery (requires double confirm) |

## Resultados

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/condominios/{id}/resultados` | Admin, Síndico, Morador | List lottery history |
| GET | `/condominios/{id}/resultados/{sid}` | Admin, Síndico, Morador | Get specific result |
| GET | `/condominios/{id}/resultados/{sid}/pdf` | Admin, Síndico | Get presigned URL for PDF download |

## Authorization Matrix

| Resource | Admin Master | Síndico | Morador |
|----------|:------------:|:-------:|:-------:|
| All condos | Full | Own condos only | Own condo (read) |
| Units | Full | Full | Read |
| Spots | Full | Full | Read |
| Preferential | Full | Full | Read |
| Sorteio (run) | Yes | Yes | No |
| Results | Full | Full | Own unit only |
| PDF export | Yes | Yes | No |

## Error Responses

```json
{ "error": "Unauthorized", "code": 401 }
{ "error": "Forbidden", "code": 403 }
{ "error": "Not found", "code": 404 }
{ "error": "Validation failed", "details": [...], "code": 422 }
{ "error": "Internal server error", "code": 500 }
```
