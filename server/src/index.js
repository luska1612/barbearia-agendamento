require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { getDb } = require('./db');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa DB (cria schema)
getDb();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Rotas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/services', require('./routes/services'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/config', require('./routes/config'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/export', require('./routes/export'));

// Servir frontend estático (index.html, admin.html, css/, js/, img/)
const publicDir = path.join(__dirname, '..', '..');
app.use(express.static(publicDir, { index: 'index.html' }));

// Fallback SPA: qualquer rota não-API serve index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Barbearia server rodando em http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/health`);
});

module.exports = app;
