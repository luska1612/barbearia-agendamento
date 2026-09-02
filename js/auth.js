/* ==========================================================================
   AUTH — login do painel admin via API (JWT) com fallback local
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  const API = window.API || null;
  const USE_API = !!API;
  const encodedPass = "YWRtaW4xMjM="; // 'admin123' em Base64 — fallback se API offline

  const loginOverlay = document.getElementById('login-overlay');
  const adminContent = document.getElementById('admin-main-content');
  const loginBtn = document.getElementById('login-btn');
  const passwordInput = document.getElementById('admin-password');
  const errorMsg = document.getElementById('login-error');

  if (!loginBtn || !passwordInput) return;

  function showAdmin() {
    if (loginOverlay) loginOverlay.classList.add('oculto');
    if (adminContent) adminContent.classList.remove('oculto');
  }
  function showLogin() {
    if (loginOverlay) loginOverlay.classList.remove('oculto');
    if (adminContent) adminContent.classList.add('oculto');
  }

  // Verifica sessão existente — com API, só entra com JWT válido
  if (USE_API) {
    const token = API.getToken();
    if (token) {
      try {
        await API.me();
        showAdmin();
      } catch (_) {
        API.clearToken();
        sessionStorage.removeItem('adminAuth');
        showLogin();
      }
    } else {
      sessionStorage.removeItem('adminAuth');
      showLogin();
    }
  } else {
    if (sessionStorage.getItem('adminAuth') === 'true') showAdmin();
    else showLogin();
  }

  async function doLogin() {
    const inputPass = passwordInput.value.trim();
    if (!inputPass) {
      if (errorMsg) { errorMsg.textContent = 'Digite a senha.'; errorMsg.style.display = 'block'; }
      return;
    }

    // Tenta via API primeiro
    if (USE_API) {
      try {
        await API.login(inputPass);
        sessionStorage.setItem('adminAuth', 'true');
        if (errorMsg) errorMsg.style.display = 'none';
        passwordInput.value = '';
        showAdmin();
        // Se admin.js já carregou, recarrega dados com token novo
        if (window.adminApp && typeof window.adminApp.refresh === 'function') {
          window.adminApp.refresh();
        }
        return;
      } catch (err) {
        if (err.status === 401) {
          if (errorMsg) { errorMsg.textContent = 'Senha incorreta!'; errorMsg.style.display = 'block'; }
          passwordInput.value = '';
          return;
        }
        // API respondeu (5xx etc.) — não fingir login local sem JWT
        if (err.status) {
          const apiErr = (err.data && err.data.error) || err.message || 'Erro no servidor.';
          if (errorMsg) { errorMsg.textContent = apiErr; errorMsg.style.display = 'block'; }
          return;
        }
        console.warn('API /auth/login falhou, tentando fallback local', err.message || err);
      }
    }

    // Fallback local (btoa)
    try {
      const encodedInput = btoa(inputPass);
      if (encodedInput === encodedPass) {
        sessionStorage.setItem('adminAuth', 'true');
        if (errorMsg) errorMsg.style.display = 'none';
        passwordInput.value = '';
        showAdmin();
      } else {
        if (errorMsg) { errorMsg.textContent = 'Senha incorreta!'; errorMsg.style.display = 'block'; }
        passwordInput.value = '';
      }
    } catch (_) {
      if (errorMsg) { errorMsg.textContent = 'Erro ao validar senha.'; errorMsg.style.display = 'block'; }
    }
  }

  loginBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
  });
});
