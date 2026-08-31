-- Barbeiros
CREATE TABLE IF NOT EXISTS barbers (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  especialidade TEXT
);

-- Servicos
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  preco REAL NOT NULL,
  duracao INTEGER NOT NULL
);

-- Config (singleton id=1)
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  abertura TEXT NOT NULL,
  fechamento TEXT NOT NULL,
  intervalo INTEGER NOT NULL,
  diasFuncionamento TEXT NOT NULL, -- JSON array ex: "[1,2,3,4,5,6]"
  localStorageAtivo INTEGER NOT NULL DEFAULT 1
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  servico_nome TEXT NOT NULL,
  servico_duracao INTEGER,
  servico_preco REAL,
  barbeiro TEXT,
  data TEXT NOT NULL,       -- YYYY-MM-DD
  horario TEXT NOT NULL,    -- HH:mm
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','realizado','cancelado')),
  observacoes TEXT,
  criadoEm TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizadoEm TEXT,
  UNIQUE(data, horario)
);

CREATE INDEX IF NOT EXISTS idx_appt_data ON appointments(data);
CREATE INDEX IF NOT EXISTS idx_appt_telefone ON appointments(cliente_telefone);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_barbeiro ON appointments(barbeiro);

-- Logs de auditoria (fase 2 — instrumentação em appointments.js)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  appointment_id TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('criado','confirmado','realizado','cancelado','editado','excluido')),
  detalhe TEXT, -- JSON: { motivo, antes, depois }
  autor TEXT,   -- 'cliente' | 'admin' | 'sistema'
  criadoEm TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_appt ON audit_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_logs(acao);

-- Exceções de horário por data (feriados, fechar mais cedo, etc.)
CREATE TABLE IF NOT EXISTS horario_excecoes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
  fechado INTEGER NOT NULL DEFAULT 0, -- 1 = fechado o dia todo
  abertura TEXT,   -- HH:mm, nullable se fechado=1
  fechamento TEXT, -- HH:mm, nullable se fechado=1
  motivo TEXT,
  criadoEm TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizadoEm TEXT
);
CREATE INDEX IF NOT EXISTS idx_excecoes_data ON horario_excecoes(data);
