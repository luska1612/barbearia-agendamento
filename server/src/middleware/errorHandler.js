function errorHandler(err, req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  const body = { error: err.message || 'Erro interno' };
  if (err.details) body.details = err.details;
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint'))) {
    return res.status(409).json({ error: 'Horário já ocupado para esta data' });
  }
  res.status(status).json(body);
}

module.exports = { errorHandler };
