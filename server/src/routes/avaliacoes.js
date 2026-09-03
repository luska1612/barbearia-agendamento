const express = require('express');
const { getDb } = require('../db');
const { z } = require('zod');

const router = express.Router();

const bodySchema = z.object({
  appointmentId: z.string().min(1),
  telefone: z.string().min(10).max(20).refine(v=>{ const d=(v||'').replace(/\D/g,''); return d.length===10||d.length===11; }, { message:'Telefone deve ter 10 ou 11 dígitos' }),
  rating: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional().or(z.literal('')).optional(),
});

function isPassado(data, horario) {
  const [h, m] = horario.split(':').map(Number);
  const d = new Date(data + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d < new Date();
}

router.post('/', async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse({ ...req.body, rating: Number(req.body.rating) });
    if (!parsed.success) {
      const err = new Error('Dados inválidos');
      err.status = 400;
      err.details = parsed.error.flatten();
      throw err;
    }
    const { appointmentId, telefone, rating, comentario } = parsed.data;
    const db = await getDb();
    const appt = await db.get('SELECT * FROM appointments WHERE id = ?', appointmentId);
    if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const telDb = (appt.cliente_telefone || '').replace(/\D/g, '');
    const telReq = telefone.replace(/\D/g, '');
    if (telReq !== telDb) return res.status(403).json({ error: 'Telefone não confere com o agendamento' });
    if (appt.status === 'cancelado') return res.status(400).json({ error: 'Agendamento cancelado não pode ser avaliado' });
    if (!isPassado(appt.data, appt.horario) && appt.status !== 'realizado') {
      return res.status(400).json({ error: 'Atendimento ainda não realizado' });
    }
    const exists = await db.get('SELECT id FROM avaliacoes WHERE appointment_id = ?', appointmentId);
    if (exists) return res.status(409).json({ error: 'Este agendamento já foi avaliado' });
    const id = 'AV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO avaliacoes (id, appointment_id, cliente_telefone, rating, comentario, "criadoEm") VALUES (?, ?, ?, ?, ?, ?)',
      id, appointmentId, telefone.trim(), rating, comentario || '', now
    );
    // ponytail: marca realizado de forma oportunista; upgrade = cron que varre agendamentos vencidos
    if (appt.status !== 'realizado') {
      try { await db.run("UPDATE appointments SET status = 'realizado', \"atualizadoEm\" = ? WHERE id = ?", now, appointmentId); } catch (_) {}
    }
    const row = await db.get('SELECT * FROM avaliacoes WHERE id = ?', id);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const { telefone, appointmentId, appointment_id } = req.query;
    const apptId = appointmentId || appointment_id;
    if (apptId) {
      const row = await db.get('SELECT * FROM avaliacoes WHERE appointment_id = ?', apptId);
      return res.json(row || null);
    }
    if (telefone) {
      const digits = telefone.replace(/\D/g, '');
      const rows = await db.all('SELECT * FROM avaliacoes WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cliente_telefone,\'(\',\'\'),\')\',\'\'),\'-\',\'\'),\' \',\'\'),\'+\',\'\') LIKE ? ORDER BY "criadoEm" DESC', `%${digits}%`);
      return res.json(rows);
    }
    const rows = await db.all('SELECT * FROM avaliacoes ORDER BY "criadoEm" DESC LIMIT 100');
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
