const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { serviceSchema, parseOr400 } = require('../utils/validators');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM services ORDER BY nome');
    res.json(rows);
  } catch(e){ next(e); }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const data = parseOr400(serviceSchema, { ...req.body, preco: Number(req.body.preco), duracao: Number(req.body.duracao) });
    const db = await getDb();
    const id = 'S' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase();
    try {
      await db.run('INSERT INTO services (id, nome, preco, duracao) VALUES (?, ?, ?, ?)', id, data.nome, data.preco, data.duracao);
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Serviço com este nome já existe'; }
      throw err;
    }
    const row = await db.get('SELECT * FROM services WHERE id = ?', id);
    res.status(201).json(row);
  } catch(e){ next(e); }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const data = parseOr400(serviceSchema, { ...req.body, preco: Number(req.body.preco), duracao: Number(req.body.duracao) });
    const db = await getDb();
    const existing = await db.get('SELECT * FROM services WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });
    try {
      await db.run('UPDATE services SET nome = ?, preco = ?, duracao = ? WHERE id = ?', data.nome, data.preco, data.duracao, req.params.id);
    } catch(err) {
      if (err.message.includes('UNIQUE')) { err.status=409; err.message='Serviço com este nome já existe'; }
      throw err;
    }
    res.json(await db.get('SELECT * FROM services WHERE id = ?', req.params.id));
  } catch(e){ next(e); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM services WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });
    await db.run('DELETE FROM services WHERE id = ?', req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

module.exports = router;
