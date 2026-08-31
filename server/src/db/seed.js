require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const { getDb } = require('./index');

const DEFAULT_SERVICOS = [
  { id: 'S1', nome: 'Corte de Cabelo', preco: 40, duracao: 40 },
  { id: 'S2', nome: 'Barba', preco: 30, duracao: 30 },
  { id: 'S3', nome: 'Corte + Barba', preco: 60, duracao: 70 },
  { id: 'S4', nome: 'Sobrancelha', preco: 15, duracao: 15 },
  { id: 'S5', nome: 'Corte Infantil', preco: 35, duracao: 35 },
  { id: 'S6', nome: 'Pigmentação de Barba', preco: 35, duracao: 30 },
];

const DEFAULT_BARBEIROS = [
  { id: 'B1', nome: 'Marcos Silva', especialidade: 'Degradê e Clássicos' },
  { id: 'B2', nome: 'Rafael Souza', especialidade: 'Barboterapia' },
  { id: 'B3', nome: 'Diego Santos', especialidade: 'Corte Infantil' },
];

const DEFAULT_CONFIG = {
  abertura: '08:00',
  fechamento: '20:00',
  intervalo: 30,
  diasFuncionamento: [1, 2, 3, 4, 5, 6],
  localStorageAtivo: 1,
};

async function seedDefaults(db, { sampleAppointments = false } = {}) {
  for (const s of DEFAULT_SERVICOS) {
    const exists = await db.get('SELECT id FROM services WHERE id = ?', s.id);
    if (!exists) {
      await db.run('INSERT INTO services (id, nome, preco, duracao) VALUES (?, ?, ?, ?)', s.id, s.nome, s.preco, s.duracao);
    }
  }

  for (const b of DEFAULT_BARBEIROS) {
    const exists = await db.get('SELECT id FROM barbers WHERE id = ?', b.id);
    if (!exists) {
      await db.run('INSERT INTO barbers (id, nome, especialidade) VALUES (?, ?, ?)', b.id, b.nome, b.especialidade);
    }
  }

  const existingConfig = await db.get('SELECT id FROM config WHERE id = 1');
  if (!existingConfig) {
    await db.run(
      'INSERT INTO config (id, abertura, fechamento, intervalo, diasFuncionamento, localStorageAtivo) VALUES (1, ?, ?, ?, ?, ?)',
      DEFAULT_CONFIG.abertura,
      DEFAULT_CONFIG.fechamento,
      DEFAULT_CONFIG.intervalo,
      JSON.stringify(DEFAULT_CONFIG.diasFuncionamento),
      DEFAULT_CONFIG.localStorageAtivo
    );
  }

  if (!sampleAppointments) return;

  const countRes = await db.get('SELECT COUNT(*) as c FROM appointments');
  const count = countRes ? countRes.c : 0;
  if (count !== 0) return;

  const hoje = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const pularDomingo = (d) => { const c = new Date(d); while (c.getDay() === 0) c.setDate(c.getDate() + 1); return c; };
  const amanha = pularDomingo(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
  const depois = pularDomingo(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 2));
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO appointments (id, cliente_nome, cliente_telefone, cliente_email, servico_nome, servico_duracao, servico_preco, barbeiro, data, horario, status, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'AG1001', 'João Pereira', '(11) 91234-5678', 'joao.pereira@email.com', 'Corte de Cabelo', 40, 40, 'Marcos Silva', iso(amanha), '10:00', 'agendado', now
  );
  await db.run(
    `INSERT INTO appointments (id, cliente_nome, cliente_telefone, cliente_email, servico_nome, servico_duracao, servico_preco, barbeiro, data, horario, status, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'AG1002', 'Carlos Souza', '(11) 99876-5432', '', 'Corte + Barba', 70, 60, 'Rafael Souza', iso(amanha), '14:00', 'agendado', now
  );
  await db.run(
    `INSERT INTO appointments (id, cliente_nome, cliente_telefone, cliente_email, servico_nome, servico_duracao, servico_preco, barbeiro, data, horario, status, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'AG1003', 'Bruno Andrade', '(11) 98765-1234', 'bruno.andrade@email.com', 'Barba', 30, 30, 'Diego Santos', iso(depois), '09:00', 'agendado', now
  );
}

function writeLocalHash(adminPassword) {
  if (process.env.VERCEL) return;
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '..', '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('ADMIN_PASSWORD_HASH')) {
    console.log('ADMIN_PASSWORD_HASH já existe no .env (não sobrescrito)');
    return;
  }
  const hash = bcrypt.hashSync(adminPassword, 10);
  fs.appendFileSync(envPath, `\nADMIN_PASSWORD_HASH=${hash}\n`);
  console.log('ADMIN_PASSWORD_HASH adicionado ao .env');
}

async function seed() {
  const db = await getDb();
  await seedDefaults(db, { sampleAppointments: true });
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  writeLocalHash(adminPassword);
  console.log(`Seed concluído. Admin password: "${adminPassword}"`);
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  });
}

module.exports = { seed, seedDefaults };
