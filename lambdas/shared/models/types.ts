export type CondoStatus = 'ATIVO' | 'INATIVO';
export type UserRole    = 'admin' | 'sindico' | 'morador';
export type UserStatus  = 'ATIVO' | 'INATIVO';
export type VagaTipo    = 'COMUM' | 'PREFERENCIAL' | 'FIXA';
export type VagaStatus  = 'LIVRE' | 'RESERVADA' | 'ATRIBUIDA' | 'FIXA' | 'PREFERENCIAL_DISPONIVEL' | 'PREFERENCIAL_ATRIBUIDA';
export type PrefTipo    = 'PCD_FISICA' | 'PCD_VISUAL' | 'PCD_AUDITIVA' | 'PCD_OUTRA' | 'IDOSO' | 'GESTANTE' | 'OUTRO';
export type SorteioModo = 'TESTE' | 'OFICIAL';
export type AtribTipo   = 'FIXA' | 'PREFERENCIAL' | 'SORTEIO' | 'SEM_VAGA';

export interface Condominio {
  id:                  string;
  nome:                string;
  cnpj?:               string;
  endereco?:           string;
  sindico?:            string;
  contato?:            string;
  status:              CondoStatus;
  percMinPreferenciais: number;
  torres:              string[];
  criadoEm:            string;
}

export interface Unidade {
  unidadeId:          string;   // {torre}#{numero}
  torre:              string;
  numero:             string;
  andar:              number;
  condoId:            string;
  direitoVagas:       number;
  elegivel:           boolean;
  obsInelegibilidade?: string;
  vagaFixa:           boolean;
  preferencial:       boolean;
}

export interface Vaga {
  id:         string;
  condoId:    string;
  numero:     number;
  andar:      string;
  parVaga?:   number;
  torre?:     string;
  tipo:       VagaTipo;
  status:     VagaStatus;
  localizacao?: string;
  unidadeId?: string;
}

export interface Preferencial {
  id:              string;
  condoId:         string;
  unidadeId:       string;
  torre:           string;
  numero:          string;
  tipoPref:        PrefTipo;
  documento?:      string;
  vagasAtribuidas: number[];
  dataInicio?:     string;
  dataValidade?:   string;
  responsavel:     string;
  obs?:            string;
  ativa:           boolean;
  criadoEm:        string;
  revokedEm?:      string;
  justificativa?:  string;
}

export interface SorteioAtribuicao {
  vagas:    number[];
  tipo:     AtribTipo;
  tipoPref?: PrefTipo;
}

export interface Sorteio {
  id:               string;
  condoId:          string;
  timestamp:        string;
  executor:         string;
  perfil:           UserRole;
  modo:             SorteioModo;
  semente:          number;
  passosFisherYates: Array<{ i: number; j: number }>;
  atribuicoes:      Record<string, SorteioAtribuicao>;
  naoElegiveis:     string[];
  vagasRestantes:   number[];
  expiresAt?:       number;   // Unix epoch — DynamoDB TTL for test records
}
