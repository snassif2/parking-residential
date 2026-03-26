# Data Model — DynamoDB Single Table

## Table: `SorteioVagasTable`

- Billing: On-Demand (PAY_PER_REQUEST)
- Point-in-time recovery: enabled
- TTL attribute: `expiresAt` (used for test lottery records)

## Key Schema

| PK | SK | Entity | Description |
|----|----|--------|-------------|
| `COND#{id}` | `METADATA` | Condomínio | Condo data (name, CNPJ, address, config, torres list) |
| `COND#{id}` | `UNID#{torre}#{numero}` | Unidade | Apartment unit (torre, floor, spot rights, eligibility) |
| `COND#{id}` | `VAGA#{id}` | Vaga | Parking spot (number, floor, type, status, pair) |
| `COND#{id}` | `PREF#{torre}#{numero}` | Preferencial | Active preferential assignment (unit → spot) |
| `COND#{id}` | `PREF#HIST#{ts}` | Preferencial Histórico | Audit trail of all preferential changes |
| `COND#{id}` | `CICLO#ATIVO` | Ciclo | Active lottery cycle metadata |
| `COND#{id}` | `SORTEIO#{timestamp}` | Resultado | Lottery result (full assignment map + seed) |
| `USER#{id}` | `METADATA` | Usuário | User data (name, login, role, status) |
| `USER#{id}` | `COND#{id}` | Vínculo | User ↔ condo link (for síndicos with multiple condos) |

## Global Secondary Indexes

### GSI1 — Users by Condo
- `GSI1PK` = `COND#{condoId}#USERS`
- `GSI1SK` = `USER#{userId}`
- Use: List all users of a condo

### GSI2 — Condos by Síndico
- `GSI2PK` = `SINDICO#{userId}`
- `GSI2SK` = `COND#{condoId}`
- Use: List all condos managed by a síndico

### GSI3 — Spots by Status
- `GSI3PK` = `COND#{condoId}#VAGAS`
- `GSI3SK` = `{status}#{vagaId}` (e.g., `LIVRE#42`, `RESERVADA#17`)
- Use: List all available/reserved/assigned spots for lottery preparation

## Entity Attributes

### Condomínio (PK=`COND#{id}`, SK=`METADATA`)
```json
{
  "PK": "COND#abc123",
  "SK": "METADATA",
  "nome": "Residencial Aurora",
  "cnpj": "12.345.678/0001-90",
  "endereco": "Rua das Flores, 100 — São Paulo, SP",
  "sindico": "João Silva",
  "contato": "joao@email.com",
  "status": "ATIVO",
  "percMinPreferenciais": 2,
  "torres": ["Torre 1", "Torre 2"],
  "criadoEm": "2025-01-01T00:00:00Z"
}
```

`torres` is an ordered list of building names within the condo. Single-building condos use `["Único"]` or `["Torre 1"]`. The values are display labels — the SK key always uses the slugified form (e.g., `T1`, `T2` or the label itself if short).

### Unidade (PK=`COND#{id}`, SK=`UNID#{torre}#{numero}`)

The SK combines torre and unit number to guarantee uniqueness across buildings. Example: apt 46 in Torre 1 → `UNID#T1#46`; apt 46 in Torre 2 → `UNID#T2#46`.

```json
{
  "PK": "COND#abc123",
  "SK": "UNID#T1#46",
  "torre": "Torre 1",
  "numero": "46",
  "unidadeId": "T1#46",
  "andar": 4,
  "direitoVagas": 2,
  "elegivel": true,
  "obsInelegibilidade": null,
  "vagaFixa": false,
  "preferencial": false,
  "GSI1PK": "COND#abc123#USERS",
  "GSI1SK": "UNID#T1#46"
}
```

`unidadeId` (`{torre}#{numero}`) is the stable business key used in all cross-entity references (preferencial, sorteio result, morador binding).

### Vaga (PK=`COND#{id}`, SK=`VAGA#{id}`)
```json
{
  "PK": "COND#abc123",
  "SK": "VAGA#42",
  "numero": 42,
  "andar": "1SS",
  "parVaga": 43,
  "tipo": "COMUM",
  "status": "LIVRE",
  "localizacao": "próxima ao elevador",
  "unidadeId": null,
  "GSI3PK": "COND#abc123#VAGAS",
  "GSI3SK": "LIVRE#42"
}
```

Spot types: `COMUM`, `PREFERENCIAL`, `FIXA`
Spot statuses: `LIVRE`, `RESERVADA`, `ATRIBUIDA`, `FIXA`, `PREFERENCIAL_DISPONIVEL`, `PREFERENCIAL_ATRIBUIDA`

### Preferencial (PK=`COND#{id}`, SK=`PREF#{torre}#{numero}`)
```json
{
  "PK": "COND#abc123",
  "SK": "PREF#T1#46",
  "unidadeId": "T1#46",
  "torre": "Torre 1",
  "numero": "46",
  "tipoPref": "PCD_FISICA",
  "documento": "CID F80 — laudo médico 2024",
  "vagasAtribuidas": [42, 43],
  "dataInicio": "2025-03-01",
  "dataValidade": null,
  "responsavel": "joao@email.com",
  "obs": "Cadeirante — vaga próxima ao elevador selecionada",
  "ativa": true
}
```

Preference types: `PCD_FISICA`, `PCD_VISUAL`, `PCD_AUDITIVA`, `PCD_OUTRA`, `IDOSO`, `GESTANTE`, `OUTRO`

### Resultado do Sorteio (PK=`COND#{id}`, SK=`SORTEIO#{timestamp}`)
```json
{
  "PK": "COND#abc123",
  "SK": "SORTEIO#2025-03-01T20:00:00Z",
  "condoId": "abc123",
  "executor": "joao@email.com",
  "perfil": "sindico",
  "modo": "OFICIAL",
  "semente": 1740862800000,
  "passosFisherYates": [...],
  "atribuicoes": {
    "T1#46": { "vagas": [42, 43], "tipo": "SORTEIO" },
    "T1#102": { "vagas": [17], "tipo": "SORTEIO" },
    "T2#46": { "vagas": [88, 89], "tipo": "SORTEIO" },
    "T1#191": { "vagas": [169, 170, 171], "tipo": "FIXA" },
    "T1#55": { "vagas": [85], "tipo": "PREFERENCIAL", "tipoPref": "IDOSO" }
  },
  "naoElegiveis": ["T1#23", "T2#67"],
  "vagasRestantes": [88, 90],
  "expiresAt": null
}
```

For test runs: `"modo": "TESTE"` and `"expiresAt": <unix timestamp 7 days ahead>` (DynamoDB TTL auto-deletes).

## Access Patterns

| Pattern | Key condition |
|---------|--------------|
| Get condo | PK=`COND#{id}`, SK=`METADATA` |
| List all units in condo | PK=`COND#{id}`, SK begins_with `UNID#` |
| List units by torre | PK=`COND#{id}`, SK begins_with `UNID#{torre}#` |
| Get specific unit | PK=`COND#{id}`, SK=`UNID#{torre}#{numero}` |
| List all spots in condo | PK=`COND#{id}`, SK begins_with `VAGA#` |
| Get active lottery cycle | PK=`COND#{id}`, SK=`CICLO#ATIVO` |
| Get lottery result | PK=`COND#{id}`, SK=`SORTEIO#{timestamp}` |
| Get preferential (unit) | PK=`COND#{id}`, SK=`PREF#{torre}#{numero}` |
| Preferential audit trail | PK=`COND#{id}`, SK begins_with `PREF#HIST#` |
| List users in condo | GSI1: `GSI1PK=COND#{id}#USERS` |
| List condos by síndico | GSI2: `GSI2PK=SINDICO#{userId}` |
| List free spots | GSI3: `GSI3PK=COND#{id}#VAGAS`, SK begins_with `LIVRE#` |
