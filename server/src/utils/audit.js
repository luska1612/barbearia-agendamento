/**
 * Auditoria — registra ações em audit_logs.
 * Uso: audit(db, { appointment_id, acao, detalhe, autor })
 * acao: 'criado' | 'confirmado' | 'cancelado' | 'editado' | 'excluido'
 * autor: 'cliente' | 'admin' | 'sistema'
 * detalhe: objeto livre (será JSON.stringify) ex: { motivo, antes, depois }
 */
function audit(db, { appointment_id, acao, detalhe, autor }) {
  try {
    const id = 'LG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    const detalheStr = detalhe ? JSON.stringify(detalhe) : null;
    db.prepare(
      'INSERT INTO audit_logs (id, appointment_id, acao, detalhe, autor) VALUES (?, ?, ?, ?, ?)'
    ).run(id, appointment_id || null, acao, detalheStr, autor || 'sistema');
  } catch (e) {
    // auditoria nunca deve quebrar a operação principal
    console.warn('[audit] falha ao registrar:', e.message);
  }
}

module.exports = { audit };
