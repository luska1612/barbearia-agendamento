document.addEventListener('DOMContentLoaded', () => {
    // Senha "admin123" codificada em Base64 para não ficar em texto puro no arquivo
    // aG1pbix3b3JsZDEyM3S= -> Não, vou usar a string correta de admin123
    const encodedPass = "YWRtaW4xMjM="; // 'admin123' em Base64

    const loginOverlay = document.getElementById('login-overlay');
    const adminContent = document.getElementById('admin-main-content');
    const loginBtn = document.getElementById('login-btn');
    const passwordInput = document.getElementById('admin-password');
    const errorMsg = document.getElementById('login-error');

    if (!loginBtn || !passwordInput) return;

    // Verifica se já está autenticado na sessão
    if (sessionStorage.getItem('adminAuth') === 'true') {
        if (loginOverlay) loginOverlay.classList.add('oculto');
        if (adminContent) adminContent.classList.remove('oculto');
    } else {
        if (loginOverlay) loginOverlay.classList.remove('oculto');
        if (adminContent) adminContent.classList.add('oculto');
    }

    loginBtn.addEventListener('click', () => {
        const inputPass = passwordInput.value.trim();
        
        // Converte a senha digitada para Base64 para comparar com a salva
        const encodedInput = btoa(inputPass);

        if (encodedInput === encodedPass) {
            sessionStorage.setItem('adminAuth', 'true');
            if (loginOverlay) loginOverlay.classList.add('oculto');
            if (adminContent) adminContent.classList.remove('oculto');
            if (errorMsg) errorMsg.style.display = 'none';
        } else {
            if (errorMsg) errorMsg.style.display = 'block';
            passwordInput.value = '';
        }
    });

    // Permitir apertar "Enter" para entrar
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
});
