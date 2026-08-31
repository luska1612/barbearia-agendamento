const fs = require('fs');
const path = require('path');

let dbInstance = null;
let dbPromise = null;
let pgPool = null;

const PG_IDENTS = ['diasFuncionamento', 'localStorageAtivo', 'criadoEm', 'atualizadoEm'];
const CAMEL_FROM_LOWER = {
  diasfuncionamento: 'diasFuncionamento',
  localstorageativo: 'localStorageAtivo',
  criadoem: 'criadoEm',
  atualizadoem: 'atualizadoEm',
};

function getPgUrl() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  return /^postgres(ql)?:\/\//i.test(url) ? url : null;
}

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'barbearia.db');
}

function sqliteToPgQuery(sql) {
  let i = 1;
  let out = sql.replace(/\?/g, () => `$${i++}`);
  for (const id of PG_IDENTS) {
    out = out.replace(new RegExp(`(?<!")\\b${id}\\b(?!")`, 'g'), `"${id}"`);
  }
  return out;
}

function normalizeRow(row) {
  if (!row) return null;
  const copy = { ...row };
  for (const k of Object.keys(copy)) {
    if (copy[k] === true) copy[k] = 1;
    if (copy[k] === false) copy[k] = 0;
    const camel = CAMEL_FROM_LOWER[k];
    if (camel && copy[camel] === undefined) copy[camel] = copy[k];
  }
  return copy;
}

function wrapPg(pool) {
  return {
    isPg: true,
    async get(sql, ...params) {
      const { rows } = await pool.query(sqliteToPgQuery(sql), params);
      return normalizeRow(rows[0]) || null;
    },
    async all(sql, ...params) {
      const { rows } = await pool.query(sqliteToPgQuery(sql), params);
      return rows.map(normalizeRow);
    },
    async run(sql, ...params) {
      const res = await pool.query(sqliteToPgQuery(sql), params);
      return { changes: res.rowCount };
    },
    async exec(sql) {
      const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await pool.query(sqliteToPgQuery(stmt));
      }
    },
    close() {
      pool.end();
      pgPool = null;
      dbInstance = null;
      dbPromise = null;
    },
  };
}

async function applySchema(db) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.exec(schema);
}

async function ensureDefaults(db) {
  const existing = await db.get('SELECT id FROM config WHERE id = 1');
  if (existing) return;
  const { seedDefaults } = require('./seed');
  try {
    await seedDefaults(db);
  } catch (e) {
    if (e.code !== '23505' && !/unique|duplicate/i.test(e.message || '')) throw e;
  }
}

async function initDb() {
  const pgUrl = getPgUrl();
  if (pgUrl) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: pgUrl,
      ssl: /localhost|127\.0\.0\.1/.test(pgUrl) ? false : { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    dbInstance = wrapPg(pgPool);
    await applySchema(dbInstance);
    await ensureDefaults(dbInstance);
    return dbInstance;
  }

  if (process.env.VERCEL) {
    throw new Error('Vercel exige Postgres. Defina DATABASE_URL (postgres://...) no projeto.');
  }

  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.resolve(getDbPath());
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const raw = new DatabaseSync(dbPath);
  try { raw.exec('PRAGMA journal_mode = WAL'); } catch (_) {}
  try { raw.exec('PRAGMA foreign_keys = ON'); } catch (_) {}

  dbInstance = {
    isPg: false,
    async get(sql, ...params) {
      return normalizeRow(raw.prepare(sql).get(...params)) || null;
    },
    async all(sql, ...params) {
      return raw.prepare(sql).all(...params).map(normalizeRow);
    },
    async run(sql, ...params) {
      const info = raw.prepare(sql).run(...params);
      return { changes: info.changes };
    },
    async exec(sql) {
      return raw.exec(sql);
    },
    close() {
      try { raw.close(); } catch (_) {}
      dbInstance = null;
      dbPromise = null;
    },
  };
  await applySchema(dbInstance);
  await ensureDefaults(dbInstance);
  return dbInstance;
}

function getDb() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!dbPromise) dbPromise = initDb();
  return dbPromise;
}

function closeDb() {
  if (dbInstance) dbInstance.close();
}

module.exports = { getDb, closeDb, getDbPath };
