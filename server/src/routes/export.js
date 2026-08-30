const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/json', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const agendamentos = db.prepare('SELECT * FROM appointments ORDER BY data, horario').all();
    const servicos = db.prepare('SELECT * FROM services ORDER BY nome').all();
    const barbeiros = db.prepare('SELECT * FROM barbers ORDER BY nome').all();
    const config = db.prepare('SELECT * FROM config WHERE id=1').get();
    res.json({ agendamentos, servicos, barbeiros, config: config ? { ...config, diasFuncionamento: JSON.parse(config.diasFuncionamento) } : null });
  } catch(e){ next(e); }
});

router.get('/csv', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM appointments ORDER BY data, horario').all();
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
