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
