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
    diasFuncionamento: typeof row.diasFuncionamento === 'string' ? JSON.parse(row.diasFuncionamento) : row.diasFuncionamento,
    localStorageAtivo: !!row.localStorageAtivo,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT * FROM config WHERE id = 1');
    if (!row) return res.status(404).json({ error: 'Config não encontrada' });
    res.json(rowToConfig(row));
  } catch(e){ next(e); }
});

router.put('/', authMiddleware, async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (typeof body.intervalo === 'string') body.intervalo = Number(body.intervalo);
    if (body.localStorageAtivo !== undefined && typeof body.localStorageAtivo !== 'boolean') {
      body.localStorageAtivo = !!body.localStorageAtivo;
    }
    const data = parseOr400(configSchema, body);
    const db = await getDb();
    await db.run('UPDATE config SET abertura=?, fechamento=?, intervalo=?, diasFuncionamento=?, localStorageAtivo=? WHERE id=1',
      data.abertura, data.fechamento, data.intervalo, JSON.stringify(data.diasFuncionamento), data.localStorageAtivo ? 1 : 0);
    const row = await db.get('SELECT * FROM config WHERE id=1');
    res.json(rowToConfig(row));
  } catch(e){ next(e); }
});

module.exports = router;
