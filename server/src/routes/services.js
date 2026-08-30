const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { serviceSchema, parseOr400 } = require('../utils/validators');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM services ORDER BY nome').all();
    res.json(rows);
  } catch(e){ next(e); }
});

router.post('/', authMiddleware, (req, res, next) => {
  try {
    const data = parseOr400(serviceSchema, { ...req.body, preco: Number(req.body.preco), duracao: Number(req.body.duracao) });
    const db = getDb();
    const id = 'S' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase();
    try {
      db.prepare('INSERT INTO services (id, nome, preco, duracao) VALUES (?, ?, ?, ?)').run(id, data.nome, data.preco, data.duracao);
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Serviço com este nome já existe'; }
      throw err;
    }
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch(e){ next(e); }
});

router.put('/:id', authMiddleware, (req, res, next) => {
  try {
    const data = parseOr400(serviceSchema, { ...req.body, preco: Number(req.body.preco), duracao: Number(req.body.duracao) });
    const db = getDb();
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });
    try {
      db.prepare('UPDATE services SET nome = ?, preco = ?, duracao = ? WHERE id = ?').run(data.nome, data.preco, data.duracao, req.params.id);
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Serviço com este nome já existe'; }
      throw err;
    }
    res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
  } catch(e){ next(e); }
});

router.delete('/:id', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

module.exports = router;
