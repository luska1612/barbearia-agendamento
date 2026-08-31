const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { excecaoSchema, excecaoUpdateSchema, parseOr400 } = require('../utils/validators');

const router = express.Router();

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    data: row.data,
    fechado: !!row.fechado,
    abertura: row.abertura || null,
    fechamento: row.fechamento || null,
    motivo: row.motivo || '',
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm || null,
  };
}

// GET /api/horario-excecoes?de=YYYY-MM-DD&ate=YYYY-MM-DD — público (usado pelo calendário)
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const { de, ate } = req.query;
    let sql = 'SELECT * FROM horario_excecoes';
    const params = [];
    const conds = [];
    if (de) { conds.push('data >= ?'); params.push(de); }
    if (ate) { conds.push('data <= ?'); params.push(ate); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY data ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(rowToApi));
  } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM horario_excecoes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Exceção não encontrada' });
    res.json(rowToApi(row));
  } catch (e) { next(e); }
});

// POST protegido
router.post('/', authMiddleware, (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.fechado !== undefined && typeof body.fechado !== 'boolean') body.fechado = !!body.fechado;
    const data = parseOr400(excecaoSchema, body);
    const db = getDb();
    const exists = db.prepare('SELECT id FROM horario_excecoes WHERE data = ?').get(data.data);
    if (exists) return res.status(409).json({ error: 'Já existe uma exceção para esta data. Use PUT para alterar.' });
    const id = 'HX' + Date.now() + Math.random().toString(36).slice(2, 4).toUpperCase();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO horario_excecoes (id, data, fechado, abertura, fechamento, motivo, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.data, data.fechado ? 1 : 0, data.fechado ? null : data.abertura, data.fechado ? null : data.fechamento, data.motivo || '', now, null);
    const row = db.prepare('SELECT * FROM horario_excecoes WHERE id = ?').get(id);
    res.status(201).json(rowToApi(row));
  } catch (e) { next(e); }
});

// PUT protegido — identifica por id (path) ou data (body)
router.put('/:id', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM horario_excecoes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Exceção não encontrada' });
    const body = { ...req.body };
    if (body.fechado !== undefined && typeof body.fechado !== 'boolean') body.fechado = !!body.fechado;
    const patch = parseOr400(excecaoUpdateSchema, body);
    // validar fechado=false exige abertura/fechamento
    const fechado = patch.fechado !== undefined ? patch.fechado : !!existing.fechado;
    const abertura = patch.abertura !== undefined ? patch.abertura : existing.abertura;
    const fechamento = patch.fechamento !== undefined ? patch.fechamento : existing.fechamento;
    if (!fechado && (!abertura || !fechamento)) {
      const e = new Error('abertura e fechamento são obrigatórios quando não fechado'); e.status = 400; throw e;
    }
    if (!fechado) {
      const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
      if (toMin(abertura) >= toMin(fechamento)) { const e = new Error('abertura deve ser antes do fechamento'); e.status = 400; throw e; }
    }
    const motivo = patch.motivo !== undefined ? patch.motivo : existing.motivo;
    const now = new Date().toISOString();
    db.prepare('UPDATE horario_excecoes SET fechado = ?, abertura = ?, fechamento = ?, motivo = ?, atualizadoEm = ? WHERE id = ?')
      .run(fechado ? 1 : 0, fechado ? null : abertura, fechado ? null : fechamento, motivo || '', now, existing.id);
    const row = db.prepare('SELECT * FROM horario_excecoes WHERE id = ?').get(existing.id);
    res.json(rowToApi(row));
  } catch (e) { next(e); }
});

router.delete('/:id', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM horario_excecoes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Exceção não encontrada' });
    db.prepare('DELETE FROM horario_excecoes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
