const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let db = null;
let raw = null;

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'barbearia.db');
}

function getDb() {
  if (db) return db;
  const dbPath = path.resolve(getDbPath());
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  raw = new DatabaseSync(dbPath);
  // Pragmas (exec em vez de pragma)
  try { raw.exec('PRAGMA journal_mode = WAL'); } catch (_) {}
  try { raw.exec('PRAGMA foreign_keys = ON'); } catch (_) {}

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  raw.exec(schema);

  // Adaptador compatível com better-sqlite3 usado nas rotas
  db = {
    exec(sql) { return raw.exec(sql); },
    pragma(stmt) { return raw.exec(`PRAGMA ${stmt}`); },
    prepare(sql) { return raw.prepare(sql); },
    close() { raw.close(); },
    transaction(fn) {
      return (...args) => {
        raw.exec('BEGIN');
        try {
          const res = fn(...args);
          raw.exec('COMMIT');
          return res;
        } catch (e) {
          try { raw.exec('ROLLBACK'); } catch (_) {}
          throw e;
        }
      };
    },
  };
  // Expõe raw para casos de uso direto se precisar
  db._raw = raw;
  return db;
}

function closeDb() {
  if (raw) { try { raw.close(); } catch (_) {} raw = null; db = null; }
  else if (db) { try { db.close(); } catch (_) {} db = null; }
}

module.exports = { getDb, closeDb, getDbPath };
