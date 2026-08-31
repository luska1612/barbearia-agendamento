const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const isoHoje = hoje.toISOString().split('T')[0];
    const seteDiasAtras = new Date(hoje); seteDiasAtras.setDate(hoje.getDate() - 7);
    const iso7 = seteDiasAtras.toISOString().split('T')[0];
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();
    const mesPrefix = `${ano}-${String(mes).padStart(2, '0')}`;

    const hojeCountRes = await db.get("SELECT COUNT(*) as c FROM appointments WHERE data = ? AND status != 'cancelado'", isoHoje);
    const hojeCount = hojeCountRes ? hojeCountRes.c : 0;

    const semanaCountRes = await db.get("SELECT COUNT(*) as c FROM appointments WHERE data BETWEEN ? AND ? AND status != 'cancelado'", iso7, isoHoje);
    const semanaCount = semanaCountRes ? semanaCountRes.c : 0;

    const mesCountRes = await db.get("SELECT COUNT(*) as c FROM appointments WHERE substr(data,1,7) = ? AND status != 'cancelado'", mesPrefix);
    const mesCount = mesCountRes ? mesCountRes.c : 0;

    const canceladosRes = await db.get("SELECT COUNT(*) as c FROM appointments WHERE status = 'cancelado'");
    const cancelados = canceladosRes ? canceladosRes.c : 0;

    const receitaRes = await db.get("SELECT COALESCE(SUM(servico_preco),0) as s FROM appointments WHERE status != 'cancelado'");
    const receita = receitaRes ? receitaRes.s : 0;

    // por dia da semana (Seg-Sab) - compatível SQLite/PG
    let grouped;
    if (db.isPg) {
      grouped = await db.all("SELECT EXTRACT(DOW FROM CAST(data AS DATE)) as w, COUNT(*) as c FROM appointments WHERE status != 'cancelado' GROUP BY w");
    } else {
      grouped = await db.all("SELECT strftime('%w', data) as w, COUNT(*) as c FROM appointments WHERE status != 'cancelado' GROUP BY w");
    }

    const map = Object.fromEntries(grouped.map(r => [Number(r.w), r.c]));
    const porDiaSemana = [1, 2, 3, 4, 5, 6].map(dia => map[dia] || 0);

    res.json({ hoje: hojeCount, semana: semanaCount, mes: mesCount, cancelados, receita, porDiaSemana });
  } catch (e) { next(e); }
});

module.exports = router;
