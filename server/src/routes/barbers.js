const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { barberSchema, parseOr400 } = require('../utils/validators');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    res.json(await db.all('SELECT * FROM barbers ORDER BY nome'));
  } catch(e){ next(e); }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const data = parseOr400(barberSchema, req.body);
    const db = await getDb();
    const id = 'B' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase();
    try {
      await db.run('INSERT INTO barbers (id, nome, especialidade) VALUES (?, ?, ?)', id, data.nome, data.especialidade || '');
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Barbeiro com este nome já existe'; }
      throw err;
    }
    res.status(201).json(await db.get('SELECT * FROM barbers WHERE id = ?', id));
  } catch(e){ next(e); }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const data = parseOr400(barberSchema, req.body);
    const db = await getDb();
    const existing = await db.get('SELECT * FROM barbers WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Barbeiro não encontrado' });
    try {
      await db.run('UPDATE barbers SET nome = ?, especialidade = ? WHERE id = ?', data.nome, data.especialidade || '', req.params.id);
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Barbeiro com este nome já existe'; }
      throw err;
    }
    res.json(await db.get('SELECT * FROM barbers WHERE id = ?', req.params.id));
  } catch(e){ next(e); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM barbers WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Barbeiro não encontrado' });
    const vinculadosRes = await db.get("SELECT COUNT(*) as c FROM appointments WHERE barbeiro = ? AND status IN ('agendado','confirmado')", existing.nome);
    const vinculados = vinculadosRes ? vinculadosRes.c : 0;
    if (vinculados > 0) {
      return res.status(409).json({ error: `Não é possível excluir: barbeiro possui ${vinculados} agendamento(s) ativo(s). Cancele ou conclua os agendamentos antes.` });
    }
    await db.run('DELETE FROM barbers WHERE id = ?', req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

module.exports = router;
