const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function timeToMin(s) { const [h,m]=s.split(':').map(Number); return h*60+m; }
function minToTime(m) { const h=Math.floor(m/60), mm=m%60; return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; }

router.get('/', (req, res, next) => {
  try {
    const { data } = req.query;
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'query param data (YYYY-MM-DD) é obrigatório' });
    const db = getDb();
    const cfgRow = db.prepare('SELECT * FROM config WHERE id=1').get();
    const cfg = cfgRow ? {
      abertura: cfgRow.abertura,
      fechamento: cfgRow.fechamento,
      intervalo: cfgRow.intervalo,
      diasFuncionamento: JSON.parse(cfgRow.diasFuncionamento),
    } : { abertura:'08:00', fechamento:'20:00', intervalo:30, diasFuncionamento:[1,2,3,4,5,6] };

    const diaSemana = new Date(data + 'T00:00:00').getDay();
    const fechado = !cfg.diasFuncionamento.includes(diaSemana);
    if (fechado) return res.json({ data, fechado: true, intervalos: [] });

    const start = timeToMin(cfg.abertura);
    const end = timeToMin(cfg.fechamento);
    const slots = [];
    for (let m = start; m < end; m += cfg.intervalo) slots.push(minToTime(m));

    // horários ocupados (não cancelados)
    const ocupados = db.prepare("SELECT horario FROM appointments WHERE data = ? AND status != 'cancelado'").all(data).map(r=>r.horario);
    const ocupadosSet = new Set(ocupados);

    const intervalos = slots.map(horario => ({ horario, disponivel: !ocupadosSet.has(horario) }));
    res.json({ data, fechado: false, intervalos, abertura: cfg.abertura, fechamento: cfg.fechamento, intervalo: cfg.intervalo });
  } catch(e){ next(e); }
});

module.exports = router;
