const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const isoHoje = hoje.toISOString().split('T')[0];
    const seteDiasAtras = new Date(hoje); seteDiasAtras.setDate(hoje.getDate() - 7);
    const iso7 = seteDiasAtras.toISOString().split('T')[0];
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();
    const mesPrefix = `${ano}-${String(mes).padStart(2, '0')}`;

    // Corrigido: semana usa BETWEEN para não contar datas futuras
    const hojeCount = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE data = ? AND status != 'cancelado'").get(isoHoje).c;
    const semanaCount = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE data BETWEEN ? AND ? AND status != 'cancelado'").get(iso7, isoHoje).c;
    const mesCount = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE substr(data,1,7) = ? AND status != 'cancelado'").get(mesPrefix).c;
    const cancelados = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'cancelado'").get().c;
    const receita = db.prepare("SELECT COALESCE(SUM(servico_preco),0) as s FROM appointments WHERE status != 'cancelado'").get().s;

    // por dia da semana (Seg-Sab) — agregado no SQL para evitar carregar tudo em memoria
    const grouped = db.prepare("SELECT strftime('%w', data) as w, COUNT(*) as c FROM appointments WHERE status != 'cancelado' GROUP BY w").all();
    const map = Object.fromEntries(grouped.map(r => [Number(r.w), r.c]));
    const porDiaSemana = [1, 2, 3, 4, 5, 6].map(dia => map[dia] || 0);

    res.json({ hoje: hojeCount, semana: semanaCount, mes: mesCount, cancelados, receita, porDiaSemana });
  } catch (e) { next(e); }
});

module.exports = router;
