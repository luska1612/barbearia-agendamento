const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function timeToMin(s) { const [h,m]=s.split(':').map(Number); return h*60+m; }
function minToTime(m) { const h=Math.floor(m/60), mm=m%60; return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; }

async function getExcecao(db, data) {
  try {
    const row = await db.get('SELECT * FROM horario_excecoes WHERE data = ?', data);
    if (!row) return null;
    return { fechado: !!row.fechado, abertura: row.abertura, fechamento: row.fechamento, motivo: row.motivo || '' };
  } catch (_) { return null; }
}

router.get('/', async (req, res, next) => {
  try {
    const { data } = req.query;
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'query param data (YYYY-MM-DD) é obrigatório' });
    const db = await getDb();
    const cfgRow = await db.get('SELECT * FROM config WHERE id=1');
    const cfg = cfgRow ? {
      abertura: cfgRow.abertura,
      fechamento: cfgRow.fechamento,
      intervalo: cfgRow.intervalo,
      diasFuncionamento: typeof cfgRow.diasFuncionamento === 'string' ? JSON.parse(cfgRow.diasFuncionamento) : cfgRow.diasFuncionamento,
    } : { abertura:'08:00', fechamento:'20:00', intervalo:30, diasFuncionamento:[1,2,3,4,5,6] };

    const exc = await getExcecao(db, data);
    if (exc) {
      if (exc.fechado) return res.json({ data, fechado: true, intervalos: [], motivo: exc.motivo || null });
      const start = timeToMin(exc.abertura);
      const end = timeToMin(exc.fechamento);
      const slots = [];
      for (let m = start; m < end; m += cfg.intervalo) slots.push(minToTime(m));
      const ocupadosRows = await db.all("SELECT horario FROM appointments WHERE data = ? AND status != 'cancelado'", data);
      const ocupados = ocupadosRows.map(r=>r.horario);
      const ocupadosSet = new Set(ocupados);
      const intervalos = slots.map(horario => ({ horario, disponivel: !ocupadosSet.has(horario) }));
      return res.json({ data, fechado: false, intervalos, abertura: exc.abertura, fechamento: exc.fechamento, intervalo: cfg.intervalo, excecao: true, motivo: exc.motivo || null });
    }

    const diaSemana = new Date(data + 'T00:00:00').getDay();
    const fechado = !cfg.diasFuncionamento.includes(diaSemana);
    if (fechado) return res.json({ data, fechado: true, intervalos: [] });

    const start = timeToMin(cfg.abertura);
    const end = timeToMin(cfg.fechamento);
    const slots = [];
    for (let m = start; m < end; m += cfg.intervalo) slots.push(minToTime(m));

    const ocupadosRows = await db.all("SELECT horario FROM appointments WHERE data = ? AND status != 'cancelado'", data);
    const ocupados = ocupadosRows.map(r=>r.horario);
    const ocupadosSet = new Set(ocupados);

    const intervalos = slots.map(horario => ({ horario, disponivel: !ocupadosSet.has(horario) }));
    res.json({ data, fechado: false, intervalos, abertura: cfg.abertura, fechamento: cfg.fechamento, intervalo: cfg.intervalo });
  } catch(e){ next(e); }
});

module.exports = router;
