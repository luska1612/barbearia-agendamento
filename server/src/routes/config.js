const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { configSchema, parseOr400 } = require('../utils/validators');

const router = express.Router();

function rowToConfig(row) {
  if (!row) return null;
  return {
    abertura: row.abertura,
    fechamento: row.fechamento,
    intervalo: row.intervalo,
    diasFuncionamento: JSON.parse(row.diasFuncionamento),
    localStorageAtivo: !!row.localStorageAtivo,
  };
}

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM config WHERE id = 1').get();
    if (!row) return res.status(404).json({ error: 'Config não encontrada' });
    res.json(rowToConfig(row));
  } catch(e){ next(e); }
});

router.put('/', authMiddleware, (req, res, next) => {
  try {
    const body = { ...req.body };
    // permitir intervalo como string
    if (typeof body.intervalo === 'string') body.intervalo = Number(body.intervalo);
    // localStorageAtivo pode vir como 0/1
    if (body.localStorageAtivo !== undefined && typeof body.localStorageAtivo !== 'boolean') {
      body.localStorageAtivo = !!body.localStorageAtivo;
    }
    const data = parseOr400(configSchema, body);
    const db = getDb();
    db.prepare('UPDATE config SET abertura=?, fechamento=?, intervalo=?, diasFuncionamento=?, localStorageAtivo=? WHERE id=1')
      .run(data.abertura, data.fechamento, data.intervalo, JSON.stringify(data.diasFuncionamento), data.localStorageAtivo ? 1 : 0);
    const row = db.prepare('SELECT * FROM config WHERE id=1').get();
    res.json(rowToConfig(row));
  } catch(e){ next(e); }
});

module.exports = router;
