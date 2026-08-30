# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Instalar dependências do backend**: `npm --prefix server install` (requer Node 18+; `better-sqlite3` pode exigir Build Tools no Windows — ver fallback abaixo)
- **Popular/seed do banco**: `npm --prefix server run seed` (cria `server/data/barbearia.db`, popula serviços/barbeiros/config e gera `ADMIN_PASSWORD_HASH` no `server/.env`)
- **Rodar o servidor (recomendado)**: `npm --prefix server start` (ou `npm --prefix server run dev` com hot-reload). Sobe em `http://localhost:3000` servindo o frontend estático + API em `/api`. Health check: `http://localhost:3000/api/health`
- **Rodar só o frontend sem backend**: abrir `index.html` direto no browser (usa `localStorage`; painel admin cai no fallback `btoa("admin123")` se a API estiver offline)

## Architecture and Structure

- `index.html` / `admin.html`: HTML principal e painel admin (o servidor Express serve ambos via `express.static`)
- `css/style.css`, `css/admin.css`, `css/admin-login.css`: estilos (identidade via variáveis CSS em `:root`; `.calendario`, `.menu-overlay`, responsivo 720/768/480px)
- `js/api.js`: client da API REST (`window.API`, JWT em `sessionStorage adminToken`, `API_BASE = /api`). Usado por `script.js`, `admin.js` e `auth.js`
- `js/script.js`: calendário, disponibilidade (`GET /api/availability`), envio do agendamento (`POST /api/appointments`), "Meus agendamentos" e menu mobile; fallback `localStorage` se API offline
- `js/admin.js`: painel admin (dashboard, agendamentos, serviços, barbeiros, configurações, export JSON/CSV). `syncData()` busca da API com fallback localStorage; CRUD via `js/api.js`; expira sessão em 401
- `js/auth.js`: login do admin via `POST /api/auth/login` (JWT) com fallback `btoa` local
- `server/`: backend Node + Express + SQLite (`better-sqlite3`)
  - `server/src/index.js`: app Express, CORS, Helmet, estático, rotas `/api/*`, `errorHandler`
  - `server/src/db/`: `schema.sql`, `index.js` (WAL), `seed.js`
  - `server/src/routes/`: `auth.js`, `appointments.js`, `services.js`, `barbers.js`, `config.js`, `availability.js`, `stats.js`, `export.js`
  - `server/src/middleware/`: `auth.js` (Bearer JWT), `errorHandler.js`
  - `server/src/utils/validators.js`: schemas `zod` + helpers de telefone/data/horário
  - `server/.env` (não commitado; ver `server/.env.example`): `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DB_PATH`, `ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH`
  - `server/data/barbearia.db`: SQLite (ignorado no git)

## Key Implementation Details

- **Scheduling Logic**: índice `UNIQUE(data, horario)` + checagem `status != 'cancelado'` retorna 409 em conflito; validações: data passada, `diasFuncionamento`, `abertura/fechamento`, alinhamento ao `intervalo`; telefone normalizado (≥10 dígitos)
- **Modelo Appointment**: `{ id, cliente:{nome,telefone,email?}, servico:{nome,duracao,preco}, barbeiro, data:YYYY-MM-DD, horario:HH:mm, status:agendado|confirmado|realizado|cancelado, criadoEm, atualizadoEm, observacoes? }` com compat flat legado (`nome/telefone/servico string/valor/data_criacao`)
- **Auth**: `bcryptjs` + `jsonwebtoken` (12h); senha padrão `admin123`; rotas protegidas exigem `Authorization: Bearer <token>`
- **Fallback Windows**: se `better-sqlite3` falhar ao compilar, usar `npm --prefix server install sqlite3` + adaptar `server/src/db/index.js` para API async, ou `sql.js` puro-JS
