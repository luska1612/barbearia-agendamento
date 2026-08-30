const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  parseOr400,
  validarTelefone,
  isDataPassada,
  isDiaFechado,
  horarioDentroFuncionamento,
  horarioAlinhadoIntervalo,
} = require('../utils/validators');

const router = express.Router();

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    cliente: {
      nome: row.cliente_nome,
      telefone: row.cliente_telefone,
      email: row.cliente_email || '',
    },
    // compat flat
    nome: row.cliente_nome,
    telefone: row.cliente_telefone,
    email: row.cliente_email || '',
    servico: {
      nome: row.servico_nome,
      duracao: row.servico_duracao,
      preco: row.servico_preco,
    },
    // compat: servico string + valor
    valor: row.servico_preco,
    barbeiro: row.barbeiro,
    data: row.data,
    horario: row.horario,
    status: row.status,
    observacoes: row.observacoes || '',
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm || null,
    data_criacao: row.criadoEm, // compat legado
  };
}

function getConfig(db) {
  const row = db.prepare('SELECT * FROM config WHERE id = 1').get();
  if (!row) return { abertura:'08:00', fechamento:'20:00', intervalo:30, diasFuncionamento:[1,2,3,4,5,6] };
  return {
    abertura: row.abertura,
    fechamento: row.fechamento,
    intervalo: row.intervalo,
    diasFuncionamento: JSON.parse(row.diasFuncionamento),
  };
}

function validarRegrasNegocio({ data, horario }, cfg) {
  if (isDataPassada(data)) {
    const e = new Error('Não é possível agendar em data passada'); e.status=400; throw e;
  }
  if (isDiaFechado(data, cfg.diasFuncionamento)) {
    const e = new Error('Barbearia fechada neste dia da semana'); e.status=400; throw e;
  }
  if (!horarioDentroFuncionamento(horario, cfg.abertura, cfg.fechamento)) {
    const e = new Error(`Horário fora do funcionamento (${cfg.abertura}–${cfg.fechamento})`); e.status=400; throw e;
  }
  if (!horarioAlinhadoIntervalo(horario, cfg.intervalo)) {
    const e = new Error(`Horário deve estar alinhado ao intervalo de ${cfg.intervalo} min`); e.status=400; throw e;
  }
}

// GET /api/appointments?data=&barbeiro=&status=&telefone=&page=&limit=&sort=
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const { data, barbeiro, status, telefone, page, limit, sort } = req.query;
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    if (data) { sql += ' AND data = ?'; params.push(data); }
    if (barbeiro && barbeiro !== 'todos') { sql += ' AND barbeiro = ?'; params.push(barbeiro); }
    if (status && status !== 'todos') { sql += ' AND LOWER(status) = LOWER(?)'; params.push(status); }
    if (telefone) {
      const digits = telefone.replace(/\D/g,'');
      // busca por dígitos normalizados: compara LIKE
      sql += ' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cliente_telefone,"(",""),")",""),"-","")," ",""),"+","") LIKE ?';
      params.push(`%${digits}%`);
    }
    // sort: data:asc ou data:desc etc — simplificado
    let orderBy = ' ORDER BY data ASC, horario ASC';
    if (sort) {
      const [field, dir] = sort.split(':');
      const allowed = ['data','horario','criadoEm','status'];
      if (allowed.includes(field)) {
        const d = (dir||'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        orderBy = ` ORDER BY ${field} ${d}`;
      }
    }
    sql += orderBy;

    // paginação opcional
    if (limit) {
      const lim = Math.min(parseInt(limit)||50, 100);
      const p = Math.max(parseInt(page)||1, 1);
      sql += ' LIMIT ? OFFSET ?'; params.push(lim, (p-1)*lim);
    }

    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(rowToApi));
  } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// POST /api/appointments (público)
router.post('/', (req, res, next) => {
  try {
    const body = req.body;
    // aceitar tanto shape aninhado quanto flat legado
    let payload = body;
    if (body.nome && !body.cliente) {
      payload = {
        cliente: { nome: body.nome, telefone: body.telefone, email: body.email || '' },
        servico: typeof body.servico === 'string'
          ? { nome: body.servico, preco: body.valor, duracao: body.duracao }
          : body.servico,
        barbeiro: body.barbeiro,
        data: body.data,
        horario: body.horario,
        observacoes: body.observacoes || '',
        status: body.status,
      };
    }
    const data = parseOr400(appointmentCreateSchema, payload);
    if (!validarTelefone(data.cliente.telefone)) {
      const e=new Error('Telefone inválido (mín. 10 dígitos)'); e.status=400; throw e;
    }
    const db = getDb();
    const cfg = getConfig(db);
    validarRegrasNegocio({ data: data.data, horario: data.horario }, cfg);

    // Verifica conflito (status != cancelado)
    const conflito = db.prepare("SELECT id FROM appointments WHERE data = ? AND horario = ? AND status != 'cancelado'").get(data.data, data.horario);
    if (conflito) return res.status(409).json({ error: 'Horário já ocupado para esta data' });

    const id = 'AG' + Date.now() + Math.random().toString(36).slice(2,5).toUpperCase();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO appointments
      (id, cliente_nome, cliente_telefone, cliente_email, servico_nome, servico_duracao, servico_preco, barbeiro, data, horario, status, observacoes, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        id,
        data.cliente.nome.trim(),
        data.cliente.telefone.trim(),
        data.cliente.email || '',
        data.servico.nome,
        data.servico.duracao || null,
        data.servico.preco ?? null,
        data.barbeiro || 'Sem preferência',
        data.data,
        data.horario,
        data.status || 'agendado',
        data.observacoes || '',
        now, null
      );
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    res.status(201).json(rowToApi(row));
  } catch(e){ next(e); }
});

// PUT /api/appointments/:id (protegido)
router.put('/:id', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

    let payload = req.body;
    if (payload.nome && !payload.cliente) {
      payload = {
        cliente: payload.nome ? { nome: payload.nome, telefone: payload.telefone, email: payload.email } : undefined,
        servico: payload.servico ? (typeof payload.servico==='string' ? { nome: payload.servico, preco: payload.valor } : payload.servico) : undefined,
        barbeiro: payload.barbeiro,
        data: payload.data,
        horario: payload.horario,
        status: payload.status,
        observacoes: payload.observacoes,
      };
      Object.keys(payload).forEach(k=> payload[k]===undefined && delete payload[k]);
    }
    const data = parseOr400(appointmentUpdateSchema, payload);
    const cfg = getConfig(db);
    const novaData = data.data || existing.data;
    const novoHorario = data.horario || existing.horario;
    if (data.data || data.horario) validarRegrasNegocio({ data: novaData, horario: novoHorario }, cfg);

    // conflito se mudou data/horario
    if (data.data || data.horario) {
      const conflito = db.prepare("SELECT id FROM appointments WHERE data = ? AND horario = ? AND id != ? AND status != 'cancelado'").get(novaData, novoHorario, req.params.id);
      if (conflito) return res.status(409).json({ error: 'Horário já ocupado para esta data' });
    }

    const updates = [];
    const params = [];
    if (data.cliente) {
      if (data.cliente.nome) { updates.push('cliente_nome = ?'); params.push(data.cliente.nome.trim()); }
      if (data.cliente.telefone) {
        if (!validarTelefone(data.cliente.telefone)) { const e=new Error('Telefone inválido'); e.status=400; throw e; }
        updates.push('cliente_telefone = ?'); params.push(data.cliente.telefone.trim());
      }
      if (data.cliente.email !== undefined) { updates.push('cliente_email = ?'); params.push(data.cliente.email || ''); }
    }
    if (data.servico) {
      if (data.servico.nome) { updates.push('servico_nome = ?'); params.push(data.servico.nome); }
      if (data.servico.duracao !== undefined) { updates.push('servico_duracao = ?'); params.push(data.servico.duracao); }
      if (data.servico.preco !== undefined) { updates.push('servico_preco = ?'); params.push(data.servico.preco); }
    }
    if (data.barbeiro !== undefined) { updates.push('barbeiro = ?'); params.push(data.barbeiro); }
    if (data.data !== undefined) { updates.push('data = ?'); params.push(data.data); }
    if (data.horario !== undefined) { updates.push('horario = ?'); params.push(data.horario); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.observacoes !== undefined) { updates.push('observacoes = ?'); params.push(data.observacoes); }
    updates.push('atualizadoEm = ?'); params.push(new Date().toISOString());
    params.push(req.params.id);

    db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// PATCH /api/appointments/:id/status
router.patch('/:id/status', authMiddleware, (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['agendado','confirmado','realizado','cancelado'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status deve ser um de: ${allowed.join(', ')}` });
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    db.prepare('UPDATE appointments SET status = ?, atualizadoEm = ? WHERE id = ?').run(status, new Date().toISOString(), req.params.id);
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// POST /api/appointments/:id/cancel (público, valida telefone)
router.post('/:id/cancel', (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const telefoneReq = (req.body.telefone || req.query.telefone || '').replace(/\D/g,'');
    const telefoneDb = (existing.cliente_telefone||'').replace(/\D/g,'');
    if (telefoneReq && telefoneReq !== telefoneDb) return res.status(403).json({ error: 'Telefone não confere com o agendamento' });
    db.prepare("UPDATE appointments SET status = 'cancelado', atualizadoEm = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// DELETE /api/appointments/:id (protegido — hard delete)
router.delete('/:id', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

// DELETE público alternativo com telefone (para compat com frontend sem auth)
router.delete('/public/:id', (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const telefoneReq = (req.body.telefone || req.query.telefone || '').replace(/\D/g,'');
    const telefoneDb = (existing.cliente_telefone||'').replace(/\D/g,'');
    if (!telefoneReq) return res.status(400).json({ error: 'Telefone é obrigatório para cancelar' });
    if (telefoneReq !== telefoneDb) return res.status(403).json({ error: 'Telefone não confere' });
    db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

module.exports = router;
