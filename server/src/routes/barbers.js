const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { barberSchema, parseOr400 } = require('../utils/validators');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    res.json(db.prepare('SELECT * FROM barbers ORDER BY nome').all());
  } catch(e){ next(e); }
});

router.post('/', authMiddleware, (req, res, next) => {
  try {
    const data = parseOr400(barberSchema, req.body);
    const db = getDb();
    const id = 'B' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase();
    try {
      db.prepare('INSERT INTO barbers (id, nome, especialidade) VALUES (?, ?, ?)').run(id, data.nome, data.especialidade || '');
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Barbeiro com este nome já existe'; }
      throw err;
    }
    res.status(201).json(db.prepare('SELECT * FROM barbers WHERE id = ?').get(id));
  } catch(e){ next(e); }
});

router.put('/:id', authMiddleware, (req, res, next) => {
  try {
    const data = parseOr400(barberSchema, req.body);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM barbers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Barbeiro não encontrado' });
    try {
      db.prepare('UPDATE barbers SET nome = ?, especialidade = ? WHERE id = ?').run(data.nome, data.especialidade || '', req.params.id);
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Barbeiro com este nome já existe'; }
      throw err;
    }
    res.json(db.prepare('SELECT * FROM barbers WHERE id = ?').get(req.params.id));
  } catch(e){ next(e); }
});

router.delete('/:id', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM barbers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Barbeiro não encontrado' });
    const vinculados = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE barbeiro = ? AND status IN ('agendado','confirmado')").get(existing.nome).c;
    if (vinculados > 0) {
      return res.status(409).json({ error: `Não é possível excluir: barbeiro possui ${vinculados} agendamento(s) ativo(s). Cancele ou conclua os agendamentos antes.` });
    }
    db.prepare('DELETE FROM barbers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

module.exports = router;
