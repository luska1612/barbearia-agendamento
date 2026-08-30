const { z } = require('zod');

const clienteSchema = z.object({
  nome: z.string().min(3).max(120),
  telefone: z.string().min(10).max(20),
  email: z.string().email().optional().or(z.literal('')).optional(),
});

const servicoSchema = z.object({
  nome: z.string().min(2).max(100),
  duracao: z.number().int().positive().max(480).optional(),
  preco: z.number().nonnegative().max(10000).optional(),
});

const appointmentCreateSchema = z.object({
  cliente: clienteSchema,
  servico: servicoSchema,
  barbeiro: z.string().min(2).max(100).optional().default('Sem preferência'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'horario deve ser HH:mm'),
  observacoes: z.string().max(500).optional().or(z.literal('')).optional(),
  status: z.enum(['agendado','confirmado','realizado','cancelado']).optional(),
});

const appointmentUpdateSchema = z.object({
  cliente: clienteSchema.optional(),
  servico: servicoSchema.optional(),
  barbeiro: z.string().min(2).max(100).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  horario: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.enum(['agendado','confirmado','realizado','cancelado']).optional(),
  observacoes: z.string().max(500).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

const serviceSchema = z.object({
  nome: z.string().min(2).max(100),
  preco: z.number().nonnegative().max(10000),
  duracao: z.number().int().positive().max(480),
});

const barberSchema = z.object({
  nome: z.string().min(2).max(100),
  especialidade: z.string().max(200).optional().or(z.literal('')).optional(),
});

const configSchema = z.object({
  abertura: z.string().regex(/^\d{2}:\d{2}$/),
  fechamento: z.string().regex(/^\d{2}:\d{2}$/),
  intervalo: z.number().int().positive().max(120),
  diasFuncionamento: z.array(z.number().int().min(0).max(6)),
  localStorageAtivo: z.boolean().optional(),
});

function parseOr400(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = new Error('Dados inválidos');
    err.status = 400;
    err.details = result.error.flatten();
    throw err;
  }
  return result.data;
}

// Validações de negócio
function normalizarTelefone(tel) {
  return (tel || '').replace(/\D/g, '');
}

function validarTelefone(tel) {
  return normalizarTelefone(tel).length >= 10;
}

function isDataPassada(dataISO) {
  const d = new Date(dataISO + 'T00:00:00');
  d.setHours(0,0,0,0);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return d < hoje;
}

function isDiaFechado(dataISO, diasFuncionamento) {
  const d = new Date(dataISO + 'T00:00:00');
  return !diasFuncionamento.includes(d.getDay());
}

function horarioDentroFuncionamento(horario, abertura, fechamento) {
  const toMin = (s) => { const [h,m]=s.split(':').map(Number); return h*60+m; };
  const h = toMin(horario);
  return h >= toMin(abertura) && h < toMin(fechamento);
}

function horarioAlinhadoIntervalo(horario, intervalo) {
  const [, m] = horario.split(':').map(Number);
  return m % intervalo === 0;
}

module.exports = {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  serviceSchema,
  barberSchema,
  configSchema,
  parseOr400,
  normalizarTelefone,
  validarTelefone,
  isDataPassada,
  isDiaFechado,
  horarioDentroFuncionamento,
  horarioAlinhadoIntervalo,
};
