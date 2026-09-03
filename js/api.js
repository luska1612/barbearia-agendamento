/* ==========================================================================
   API CLIENT — camada de acesso ao backend
   Expõe window.API com métodos para todas as rotas.
   Usa fetch + JWT (sessionStorage adminToken). Fallback silencioso se API offline.
   ========================================================================== */
(function () {
  'use strict';

  const API_BASE = window.__API_BASE__ || '/api';
  const TOKEN_KEY = 'adminToken';

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
  }
  function setToken(token) {
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch (_) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (_) {}
  }

  async function request(path, opts = {}) {
    const url = API_BASE + path;
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...opts, headers });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Erro ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Auth
  async function login(password) {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
    if (data.token) setToken(data.token);
    return data;
  }
  async function me() { return request('/auth/me'); }

  // Appointments
  function listAppointments(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) qs.set(k, v);
    const q = qs.toString();
    return request('/appointments' + (q ? '?' + q : ''));
  }
  function getAppointment(id) { return request('/appointments/' + encodeURIComponent(id)); }
  function createAppointment(payload) { return request('/appointments', { method: 'POST', body: JSON.stringify(payload) }); }
  function updateAppointment(id, payload) { return request('/appointments/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) }); }
  function patchStatus(id, status, motivo) {
    const body = motivo ? { status, motivo } : { status };
    return request('/appointments/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify(body) });
  }
  function cancelAppointment(id, telefone, motivo) {
    const body = { telefone: telefone || '' };
    if (motivo) body.motivo = motivo;
    return request('/appointments/' + encodeURIComponent(id) + '/cancel', { method: 'POST', body: JSON.stringify(body) });
  }
  function deleteAppointment(id) { return request('/appointments/' + encodeURIComponent(id), { method: 'DELETE' }); }
  function publicDeleteAppointment(id, telefone) { return request('/appointments/public/' + encodeURIComponent(id) + '?telefone=' + encodeURIComponent(telefone||''), { method: 'DELETE' }); }
  function listByPhone(telefone) { return request('/appointments/phone/' + encodeURIComponent(telefone || '')); }
  function getAvailabilityAppointments(data) { return request('/appointments/availability?data=' + encodeURIComponent(data)); }
  function getAppointmentLogs(id) { return request('/appointments/' + encodeURIComponent(id) + '/logs'); }

  // Availability (alias antigo)
  function getAvailability(data) { return request('/availability?data=' + encodeURIComponent(data)); }

  // Services
  function listServices() { return request('/services'); }
  function createService(payload) { return request('/services', { method: 'POST', body: JSON.stringify(payload) }); }
  function updateService(id, payload) { return request('/services/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) }); }
  function deleteService(id) { return request('/services/' + encodeURIComponent(id), { method: 'DELETE' }); }

  // Barbers
  function listBarbers() { return request('/barbers'); }
  function createBarber(payload) { return request('/barbers', { method: 'POST', body: JSON.stringify(payload) }); }
  function updateBarber(id, payload) { return request('/barbers/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) }); }
  function deleteBarber(id) { return request('/barbers/' + encodeURIComponent(id), { method: 'DELETE' }); }

  // Config
  function getConfig() { return request('/config'); }
  function updateConfig(payload) { return request('/config', { method: 'PUT', body: JSON.stringify(payload) }); }

  // Stats
  function getDashboard() { return request('/stats/dashboard'); }

  // Export (precisa token no header — fetch com blob)
  async function exportJson() {
    const token = getToken();
    const res = await fetch(API_BASE + '/export/json', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    if (!res.ok) throw new Error('Falha ao exportar JSON');
    return res.json();
  }
  async function exportCsvBlob() {
    const token = getToken();
    const res = await fetch(API_BASE + '/export/csv', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    if (!res.ok) throw new Error('Falha ao exportar CSV');
    return res.blob();
  }

  // Avaliacoes
  function createAvaliacao(payload){ return request('/avaliacoes',{method:'POST',body:JSON.stringify(payload)}); }
  function getAvaliacao(appointmentId){ return request('/avaliacoes?appointmentId='+encodeURIComponent(appointmentId)); }

  // Horario excecoes (por data)
  function listExcecoes(params={}) {
    const qs = new URLSearchParams();
    for(const[k,v] of Object.entries(params)) if(v!==undefined&&v!==''&&v!==null) qs.set(k,v);
    const q=qs.toString();
    return request('/horario-excecoes'+(q?'?'+q:''));
  }
  function createExcecao(payload){ return request('/horario-excecoes',{method:'POST',body:JSON.stringify(payload)}); }
  function updateExcecao(id,payload){ return request('/horario-excecoes/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(payload)}); }
  function deleteExcecao(id){ return request('/horario-excecoes/'+encodeURIComponent(id),{method:'DELETE'}); }

  window.API = {
    API_BASE, getToken, setToken, clearToken,
    login, me,
    listAppointments, getAppointment, createAppointment, updateAppointment, patchStatus, cancelAppointment, deleteAppointment, publicDeleteAppointment,
    listByPhone, getAvailabilityAppointments, getAppointmentLogs,
    getAvailability,
    listServices, createService, updateService, deleteService,
    listBarbers, createBarber, updateBarber, deleteBarber,
    getConfig, updateConfig,
    getDashboard,
    exportJson, exportCsvBlob,
    createAvaliacao, getAvaliacao,
    listExcecoes, createExcecao, updateExcecao, deleteExcecao,
    _request: request,
  };
})();
