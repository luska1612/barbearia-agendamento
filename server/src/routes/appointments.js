const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { audit } = require('../utils/audit');
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

async function getConfig(db) {
  const row = await db.get('SELECT * FROM config WHERE id = 1');
  if (!row) return { abertura:'08:00', fechamento:'20:00', intervalo:30, diasFuncionamento:[1,2,3,4,5,6] };
  return {
    abertura: row.abertura,
    fechamento: row.fechamento,
    intervalo: row.intervalo,
    diasFuncionamento: typeof row.diasFuncionamento === 'string' ? JSON.parse(row.diasFuncionamento) : row.diasFuncionamento,
  };
}

async function getExcecao(db, data) {
  try {
    const row = await db.get('SELECT * FROM horario_excecoes WHERE data = ?', data);
    if (!row) return null;
    return { fechado: !!row.fechado, abertura: row.abertura, fechamento: row.fechamento, motivo: row.motivo || '' };
  } catch (_) { return null; }
}

async function resolveHorarioDia(db, data, cfg) {
  const exc = await getExcecao(db, data);
  if (exc) {
    if (exc.fechado) return { fechado: true, motivo: exc.motivo || 'Fechado (exceção)' };
    return { fechado: false, abertura: exc.abertura, fechamento: exc.fechamento, intervalo: cfg.intervalo, excecao: true, motivo: exc.motivo || '' };
  }
  return { fechado: false, abertura: cfg.abertura, fechamento: cfg.fechamento, intervalo: cfg.intervalo };
}

async function validarRegrasNegocio({ data, horario }, cfg, db) {
  if (isDataPassada(data)) {
    const e = new Error('Não é possível agendar em data passada'); e.status=400; throw e;
  }
  if (db) {
    const exc = await getExcecao(db, data);
    if (exc) {
      if (exc.fechado) { const e = new Error(exc.motivo ? `Fechado: ${exc.motivo}` : 'Barbearia fechada nesta data'); e.status=400; throw e; }
      if (!horarioDentroFuncionamento(horario, exc.abertura, exc.fechamento)) {
        const e = new Error(`Horário fora do funcionamento excepcional (${exc.abertura}–${exc.fechamento})`); e.status=400; throw e;
      }
      if (!horarioAlinhadoIntervalo(horario, cfg.intervalo)) {
        const e = new Error(`Horário deve estar alinhado ao intervalo de ${cfg.intervalo} min`); e.status=400; throw e;
      }
      return;
    }
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

function timeToMin(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function minToTime(m) { const h = Math.floor(m / 60), mm = m % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

// GET /api/appointments/phone/:telefone
router.get('/phone/:telefone', async (req, res, next) => {
  try {
    const db = await getDb();
    const digits = (req.params.telefone || '').replace(/\D/g, '');
    if (!digits) return res.status(400).json({ error: 'Telefone é obrigatório' });
    const rows = await db.all(
      `SELECT * FROM appointments WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cliente_telefone,'(',''),')',''),'-',''),' ',''),'+','') LIKE ? ORDER BY data ASC, horario ASC`,
      `%${digits}%`
    );
    res.json(rows.map(rowToApi));
  } catch (e) { next(e); }
});

// GET /api/appointments/availability?data=YYYY-MM-DD
router.get('/availability', async (req, res, next) => {
  try {
    const { data } = req.query;
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'query param data (YYYY-MM-DD) é obrigatório' });
    const db = await getDb();
    const cfg = await getConfig(db);
    const resolvido = await resolveHorarioDia(db, data, cfg);
    if (resolvido.fechado) return res.json({ data, fechado: true, intervalos: [], motivo: resolvido.motivo || null });
    if (!resolvido.excecao) {
      const diaSemana = new Date(data + 'T00:00:00').getDay();
      if (!cfg.diasFuncionamento.includes(diaSemana)) return res.json({ data, fechado: true, intervalos: [] });
    }
    const start = timeToMin(resolvido.abertura);
    const end = timeToMin(resolvido.fechamento);
    const slots = [];
    for (let m = start; m < end; m += resolvido.intervalo) slots.push(minToTime(m));
    const ocupadosRows = await db.all("SELECT horario FROM appointments WHERE data = ? AND status != 'cancelado'", data);
    const ocupados = ocupadosRows.map(r => r.horario);
    const ocupadosSet = new Set(ocupados);
    const intervalos = slots.map(horario => ({ horario, disponivel: !ocupadosSet.has(horario) }));
    res.json({ data, fechado: false, intervalos, abertura: resolvido.abertura, fechamento: resolvido.fechamento, intervalo: resolvido.intervalo, excecao: !!resolvido.excecao, motivo: resolvido.motivo || null });
  } catch (e) { next(e); }
});

// GET /api/appointments
router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const { data, barbeiro, status, telefone, page, limit, sort } = req.query;
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    if (data) { sql += ' AND data = ?'; params.push(data); }
    if (barbeiro && barbeiro !== 'todos') { sql += ' AND barbeiro = ?'; params.push(barbeiro); }
    if (status && status !== 'todos') { sql += ' AND LOWER(status) = LOWER(?)'; params.push(status); }
    if (telefone) {
      const digits = telefone.replace(/\D/g,'');
      sql += " AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cliente_telefone,'(',''),')',''),'-',''),' ',''),'+','') LIKE ?";
      params.push(`%${digits}%`);
    }
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

    if (limit) {
      const lim = Math.min(parseInt(limit)||50, 100);
      const p = Math.max(parseInt(page)||1, 1);
      sql += ' LIMIT ? OFFSET ?'; params.push(lim, (p-1)*lim);
    }

    const rows = await db.all(sql, ...params);
    res.json(rows.map(rowToApi));
  } catch (e) { next(e); }
});

// GET /api/appointments/:id/logs
router.get('/:id/logs', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM appointments WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const logs = await db.all('SELECT id, appointment_id as appointmentId, acao, detalhe, autor, criadoEm FROM audit_logs WHERE appointment_id = ? ORDER BY criadoEm ASC', req.params.id);
    const mapped = logs.map(r => ({ ...r, detalhe: r.detalhe ? JSON.parse(r.detalhe) : null }));
    res.json(mapped);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// POST /api/appointments
router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
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
    const db = await getDb();
    const cfg = await getConfig(db);
    await validarRegrasNegocio({ data: data.data, horario: data.horario }, cfg, db);

    const conflito = await db.get("SELECT id FROM appointments WHERE data = ? AND horario = ? AND status != 'cancelado'", data.data, data.horario);
    if (conflito) return res.status(409).json({ error: 'Horário já ocupado para esta data' });

    const id = 'AG' + Date.now() + Math.random().toString(36).slice(2,5).toUpperCase();
    const now = new Date().toISOString();
    await db.run(`INSERT INTO appointments
      (id, cliente_nome, cliente_telefone, cliente_email, servico_nome, servico_duracao, servico_preco, barbeiro, data, horario, status, observacoes, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const row = await db.get('SELECT * FROM appointments WHERE id = ?', id);
    await audit(db, { appointment_id: id, acao: 'criado', detalhe: { cliente: data.cliente, servico: data.servico, barbeiro: data.barbeiro, data: data.data, horario: data.horario }, autor: 'cliente' });
    res.status(201).json(rowToApi(row));
  } catch(e){ next(e); }
});

// PUT /api/appointments/:id
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
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
    const cfg = await getConfig(db);
    const novaData = data.data || existing.data;
    const novoHorario = data.horario || existing.horario;
    if (data.data || data.horario) await validarRegrasNegocio({ data: novaData, horario: novoHorario }, cfg, db);

    if (data.data || data.horario) {
      const conflito = await db.get("SELECT id FROM appointments WHERE data = ? AND horario = ? AND id != ? AND status != 'cancelado'", novaData, novoHorario, req.params.id);
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

    const antes = { ...existing };
    await db.run(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, ...params);
    const row = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    await audit(db, { appointment_id: req.params.id, acao: 'editado', detalhe: { antes: rowToApi(antes), depois: rowToApi(row) }, autor: 'admin' });
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// PATCH /api/appointments/:id/status
router.patch('/:id/status', authMiddleware, async (req, res, next) => {
  try {
    const { status, motivo } = req.body;
    const allowed = ['agendado','confirmado','realizado','cancelado'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status deve ser um de: ${allowed.join(', ')}` });
    const db = await getDb();
    const existing = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const obs = motivo ? `${existing.observacoes ? existing.observacoes + ' | ' : ''}Motivo cancelamento: ${motivo}` : existing.observacoes;
    if (motivo && status === 'cancelado') {
      await db.run('UPDATE appointments SET status = ?, observacoes = ?, atualizadoEm = ? WHERE id = ?', status, obs, new Date().toISOString(), req.params.id);
    } else {
      await db.run('UPDATE appointments SET status = ?, atualizadoEm = ? WHERE id = ?', status, new Date().toISOString(), req.params.id);
    }
    const acaoMap = { confirmado: 'confirmado', realizado: 'realizado', cancelado: 'cancelado', agendado: 'editado' };
    await audit(db, { appointment_id: req.params.id, acao: acaoMap[status] || 'editado', detalhe: { de: existing.status, para: status, motivo: motivo || null }, autor: 'admin' });
    const row = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// POST /api/appointments/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const telefoneReq = (req.body.telefone || req.query.telefone || '').replace(/\D/g,'');
    const telefoneDb = (existing.cliente_telefone||'').replace(/\D/g,'');
    if (telefoneReq && telefoneReq !== telefoneDb) return res.status(403).json({ error: 'Telefone não confere com o agendamento' });
    const motivo = (req.body.motivo || '').trim();
    const obs = motivo ? `${existing.observacoes ? existing.observacoes + ' | ' : ''}Motivo cancelamento: ${motivo}` : existing.observacoes;
    if (motivo) {
      await db.run("UPDATE appointments SET status = 'cancelado', observacoes = ?, atualizadoEm = ? WHERE id = ?", obs, new Date().toISOString(), req.params.id);
    } else {
      await db.run("UPDATE appointments SET status = 'cancelado', atualizadoEm = ? WHERE id = ?", new Date().toISOString(), req.params.id);
    }
    await audit(db, { appointment_id: req.params.id, acao: 'cancelado', detalhe: { motivo: motivo || null, telefone: telefoneReq ? 'validado' : 'sem validacao' }, autor: 'cliente' });
    const row = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    res.json(rowToApi(row));
  } catch(e){ next(e); }
});

// DELETE /api/appointments/:id
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    await audit(db, { appointment_id: req.params.id, acao: 'excluido', detalhe: { snapshot: rowToApi(existing) }, autor: 'admin' });
    await db.run('DELETE FROM appointments WHERE id = ?', req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

// DELETE público alternativo com telefone
router.delete('/public/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const telefoneReq = (req.body.telefone || req.query.telefone || '').replace(/\D/g,'');
    const telefoneDb = (existing.cliente_telefone||'').replace(/\D/g,'');
    if (!telefoneReq) return res.status(400).json({ error: 'Telefone é obrigatório para cancelar' });
    if (telefoneReq !== telefoneDb) return res.status(403).json({ error: 'Telefone não confere' });
    await audit(db, { appointment_id: req.params.id, acao: 'excluido', detalhe: { snapshot: rowToApi(existing), via: 'public' }, autor: 'cliente' });
    await db.run('DELETE FROM appointments WHERE id = ?', req.params.id);
    res.json({ ok: true });
  } catch(e){ next(e); }
});

module.exports = router;
