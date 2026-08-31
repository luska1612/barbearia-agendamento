# Barbearia — Agendamento Online

Sistema de agendamento para barbearia com backend Node + Express + SQLite e frontend Vanilla JS. O servidor serve o frontend estático e expõe API em `/api`.

## Estrutura

```
.                  → frontend (index.html, admin.html, css/, js/, img/)
server/            → backend Node + Express + SQLite
  src/
    index.js       → app Express, CORS, Helmet, estático, /api/*
    db/            → schema.sql, index.js (WAL), seed.js
    routes/        → auth, appointments, services, barbers, config, availability, stats, export
    middleware/    → auth (Bearer JWT), errorHandler
    utils/        → validators (zod) + audit
  data/barbearia.db → SQLite (ignorado no git)
  .env            → não commitado (ver .env.example)
```

A pasta duplicada `projeto-barbearia/` foi removida. Frontend fica na raiz; backend em `server/`.

## Instalação

Requer Node 18+ (recomendado 22+ para `node:sqlite`).

```bash
npm --prefix server install
npm --prefix server run seed   # cria server/data/barbearia.db e ADMIN_PASSWORD_HASH
npm --prefix server start      # http://localhost:3000  (dev: npm --prefix server run dev)
```

Health check: `GET http://localhost:3000/api/health`

Sem backend: abrir `index.html` direto no browser usa `localStorage` (painel admin cai no fallback `btoa("admin123")`).

> Windows: se `better-sqlite3` falhar ao compilar, use `npm --prefix server install sqlite3` e adapte `server/src/db/index.js` para API async, ou `sql.js` puro-JS.

## Variáveis de ambiente

Copie `server/.env.example` para `server/.env`:

```
PORT=3000
JWT_SECRET=troque-este-segredo-em-producao
JWT_EXPIRES_IN=12h
DATABASE_URL=./data/barbearia.db   # alias de DB_PATH (DATABASE_URL tem prioridade)
DB_PATH=./data/barbearia.db
ADMIN_PASSWORD=admin123
# ADMIN_PASSWORD_HASH gerado por npm --prefix server run seed
```

## API — Endpoints

Base: `/api`

### Auth
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | /auth/login | não | `{password}` → `{token}` (JWT 12h) |
| GET | /auth/me | Bearer | retorna usuário do token |

### Agendamentos
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | /appointments?data=&barbeiro=&status=&telefone=&page=&limit=&sort= | não | lista com filtros, paginação (`limit`/`page`) e `sort=data:asc\|desc` |
| GET | /appointments/phone/:telefone | não | alias de `?telefone=` (busca por dígitos normalizados) |
| GET | /appointments/availability?data=YYYY-MM-DD | não | alias de `/availability` — `{fechado, intervalos:[{horario,disponivel}]}` |
| GET | /appointments/:id | não | detalhe |
| GET | /appointments/:id/logs | Bearer | histórico de auditoria do agendamento |
| POST | /appointments | não | cria; valida telefone, data passada, `diasFuncionamento`, `abertura/fechamento`, `intervalo`; 409 se `UNIQUE(data,horario)` com `status != cancelado` |
| PUT | /appointments/:id | Bearer | edita (aceita shape aninhado ou flat legado) |
| PATCH | /appointments/:id/status | Bearer | `{status, motivo?}` — se `cancelado` com `motivo`, anexa em `observacoes` |
| POST | /appointments/:id/cancel | não | cancela com validação de telefone; aceita `{telefone, motivo}` |
| DELETE | /appointments/:id | Bearer | hard delete (admin) |
| DELETE | /appointments/public/:id?telefone= | não | hard delete público com validação de telefone |

Compat: `GET /availability?data=` e `GET /appointments` com filtros antigos continuam funcionando.

Modelo `Appointment`: `{ id, cliente:{nome,telefone,email?}, servico:{nome,duracao,preco}, barbeiro, data:YYYY-MM-DD, horario:HH:mm, status:agendado|confirmado|realizado|cancelado, criadoEm, atualizadoEm, observacoes? }` + compat flat (`nome/telefone/servico string/valor/data_criacao`).

### Outros
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | /availability?data=YYYY-MM-DD | não | disponibilidade por intervalos |
| GET | /services | não | lista serviços |
| POST/PUT/DELETE | /services[/:id] | Bearer | CRUD serviços |
| GET | /barbers | não | lista barbeiros |
| POST/PUT/DELETE | /barbers[/:id] | Bearer | CRUD; DELETE bloqueia com 409 se houver agendamento ativo |
| GET | /config | não | config (abertura/fechamento/intervalo/diasFuncionamento) |
| PUT | /config | Bearer | atualiza config |
| GET | /stats/dashboard | Bearer | `{hoje, semana, mes, cancelados, receita, porDiaSemana[Seg..Sáb]}` |
| GET | /export/json | Bearer | dump JSON |
| GET | /export/csv | Bearer | CSV |

## Painel Admin (`admin.html`)

- Login por senha (`admin123` via `.env` → JWT em `sessionStorage adminToken`; fallback `btoa` se API offline).
- Dashboard: Hoje / Semana / Cancelados / Faturamento + gráfico por dia da semana (via `GET /stats/dashboard`).
- Agendamentos: filtros por data, barbeiro, status + busca por nome/telefone; ações Confirmar (→ `confirmado`), Concluir (`realizado`), Cancelar (modal com motivo → `PATCH /:id/status`), Editar (modal com histórico via `GET /:id/logs`), Excluir (DELETE). 401 expira sessão e volta ao login.
- Logs: toda ação (`criado,confirmado,realizado,cancelado,editado,excluido`) gravada em `audit_logs` (DB) com `detalhe` JSON e `autor` cliente|admin.

## Rodar local

```bash
npm --prefix server install
npm --prefix server run seed
npm --prefix server start
# abrir http://localhost:3000  e  http://localhost:3000/admin.html
```

## Licença

Uso interno / demonstração.
