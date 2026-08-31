function errorHandler(err, req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  const body = { error: err.message || 'Erro interno' };
  if (err.details) body.details = err.details;
  if (
    err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    err.code === '23505' ||
    (err.message && /unique constraint|duplicate key/i.test(err.message))
  ) {
    return res.status(409).json({ error: 'Horário já ocupado para esta data' });
  }
  res.status(status).json(body);
}

module.exports = { errorHandler };
