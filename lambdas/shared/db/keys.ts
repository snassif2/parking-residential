// DynamoDB key construction helpers — single source of truth for all PKs/SKs

export const keys = {
  condo:       (id: string)                  => ({ PK: `COND#${id}`,   SK: 'METADATA' }),
  unidade:     (condoId: string, uid: string) => ({ PK: `COND#${condoId}`, SK: `UNID#${uid}` }),
  vaga:        (condoId: string, vid: string) => ({ PK: `COND#${condoId}`, SK: `VAGA#${vid}` }),
  preferencial:(condoId: string, uid: string) => ({ PK: `COND#${condoId}`, SK: `PREF#${uid}` }),
  prefHist:    (condoId: string, ts: string)  => ({ PK: `COND#${condoId}`, SK: `PREF#HIST#${ts}` }),
  ciclo:       (condoId: string)              => ({ PK: `COND#${condoId}`, SK: 'CICLO#ATIVO' }),
  sorteio:     (condoId: string, ts: string)  => ({ PK: `COND#${condoId}`, SK: `SORTEIO#${ts}` }),
  user:        (id: string)                  => ({ PK: `USER#${id}`,    SK: 'METADATA' }),
  userCondo:   (userId: string, condoId: string) => ({ PK: `USER#${userId}`, SK: `COND#${condoId}` }),
};

export const prefixes = {
  condoAll:      (condoId: string) => ({ PK: `COND#${condoId}` }),
  unidades:      (condoId: string) => `UNID#`,
  vagas:         (condoId: string) => `VAGA#`,
  preferenciais: (condoId: string) => `PREF#`,
  sorteios:      (condoId: string) => `SORTEIO#`,
};

export const gsi = {
  // GSI1: users by condo
  usersByCondo: (condoId: string) => ({ GSI1PK: `COND#${condoId}#USERS` }),
  userInCondo:  (condoId: string, userId: string) => ({ GSI1PK: `COND#${condoId}#USERS`, GSI1SK: `USER#${userId}` }),

  // GSI2: condos by sindico
  condosBySindico: (userId: string) => ({ GSI2PK: `SINDICO#${userId}` }),
  sindicoInCondo:  (userId: string, condoId: string) => ({ GSI2PK: `SINDICO#${userId}`, GSI2SK: `COND#${condoId}` }),

  // GSI3: spots by status
  vagasByStatus: (condoId: string) => ({ GSI3PK: `COND#${condoId}#VAGAS` }),
  vagaStatus:    (condoId: string, status: string, vagaId: string) => ({
    GSI3PK: `COND#${condoId}#VAGAS`,
    GSI3SK: `${status}#${vagaId}`,
  }),
};
