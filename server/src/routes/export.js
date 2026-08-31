const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/json', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const agendamentos = await db.all('SELECT * FROM appointments ORDER BY data, horario');
    const servicos = await db.all('SELECT * FROM services ORDER BY nome');
    const barbeiros = await db.all('SELECT * FROM barbers ORDER BY nome');
    const config = await db.get('SELECT * FROM config WHERE id=1');
    res.json({
      agendamentos,
      servicos,
      barbeiros,
      config: config ? { ...config, diasFuncionamento: typeof config.diasFuncionamento === 'string' ? JSON.parse(config.diasFuncionamento) : config.diasFuncionamento } : null
    });
  } catch(e){ next(e); }
});

router.get('/csv', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM appointments ORDER BY data, horario');
    let csv = 'Data,Hora,Cliente,Telefone,Servico,Barbeiro,Status\n';
    for (const a of rows) {
      csv += `${a.data},${a.horario},"${(a.cliente_nome||'').replace(/"/g,'""')}","${(a.cliente_telefone||'').replace(/"/g,'""')}","${(a.servico_nome||'').replace(/"/g,'""')}","${(a.barbeiro||'').replace(/"/g,'""')}",${a.status}\n`;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="agenda_barbearia_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch(e){ next(e); }
});

module.exports = router;
