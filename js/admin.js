/* ==========================================================================
   LÓGICA DO PAINEL ADMINISTRATIVO — com API REST + fallback localStorage
   ========================================================================== */

(function () {
    'use strict';

    const API = window.API || null;
    const USE_API = !!API;

    // --- CONSTANTES E CONFIGURAÇÕES ---
    const STORAGE_KEYS = {
        AGENDAMENTOS: 'barbearia_agendamentos',
        SERVICOS: 'barbearia_servicos',
        BARBEIROS: 'barbearia_barbeiros',
        CONFIG: 'barbearia_config'
    };

    const DEFAULT_CONFIG = {
        abertura: '08:00',
        fechamento: '20:00',
        intervalo: 30,
        diasFuncionamento: [1, 2, 3, 4, 5, 6],
        localStorageAtivo: true
    };

    const DEFAULT_SERVICOS = [
        { id: 'S1', nome: 'Corte de Cabelo', preco: 40, duracao: 40 },
        { id: 'S2', nome: 'Barba', preco: 30, duracao: 30 },
        { id: 'S3', nome: 'Corte + Barba', preco: 60, duracao: 70 },
        { id: 'S4', nome: 'Sobrancelha', preco: 15, duracao: 15 },
        { id: 'S5', nome: 'Corte Infantil', preco: 35, duracao: 35 },
        { id: 'S6', nome: 'Pigmentação de Barba', preco: 35, duracao: 30 }
    ];

    const DEFAULT_BARBEIROS = [
        { id: 'B1', nome: 'Marcos Silva', especialidade: 'Degradê e Clássicos' },
        { id: 'B2', nome: 'Rafael Souza', especialidade: 'Barboterapia' },
        { id: 'B3', nome: 'Diego Santos', especialidade: 'Corte Infantil' }
    ];

    // --- ESTADO GLOBAL ---
    let state = {
        agendamentos: [],
        servicos: [],
        barbeiros: [],
        config: { ...DEFAULT_CONFIG },
        excecoes: [],
        currentSection: 'dashboard'
    };

    // --- UTILITÁRIOS ---
    const utils = {
        save(key, data) {
            try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
        },
        load(key, fallback) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : fallback;
            } catch (_) { return fallback; }
        },
        formatDateBR(isoDate) {
            if (!isoDate) return '';
            const [ano, mes, dia] = isoDate.split('-');
            return `${dia}/${mes}/${ano}`;
        },
        formatCurrency(value) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        },
        generateId() {
            return 'ID_' + Math.random().toString(36).slice(2, 11);
        },
        showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },
        escaparHTML(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    function handle401(err) {
        if (err && err.status === 401) {
            if (API) API.clearToken();
            sessionStorage.removeItem('adminAuth');
            utils.showToast('Sessão expirada. Faça login novamente.', 'error');
            const overlay = document.getElementById('login-overlay');
            const content = document.getElementById('admin-main-content');
            if (overlay) overlay.classList.remove('oculto');
            if (content) content.classList.add('oculto');
            return true;
        }
        return false;
    }

    // --- GESTÃO DE DADOS ---
    async function syncData() {
        if (USE_API) {
            try {
                const [agendamentos, servicos, barbeiros, config, excecoes] = await Promise.all([
                    API.listAppointments().catch(() => null),
                    API.listServices().catch(() => null),
                    API.listBarbers().catch(() => null),
                    API.getConfig().catch(() => null),
                    (API.listExcecoes ? API.listExcecoes().catch(() => null) : Promise.resolve(null)),
                ]);
                if (Array.isArray(agendamentos)) state.agendamentos = agendamentos;
                else state.agendamentos = utils.load(STORAGE_KEYS.AGENDAMENTOS, []);
                if (Array.isArray(servicos)) state.servicos = servicos;
                else state.servicos = utils.load(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
                if (Array.isArray(barbeiros)) state.barbeiros = barbeiros;
                else state.barbeiros = utils.load(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);
                if (config && config.abertura) state.config = { ...DEFAULT_CONFIG, ...config, diasFuncionamento: config.diasFuncionamento || DEFAULT_CONFIG.diasFuncionamento };
                else state.config = utils.load(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
                if (Array.isArray(excecoes)) state.excecoes = excecoes; else state.excecoes = [];

                // cache local para modo offline
                utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
                utils.save(STORAGE_KEYS.SERVICOS, state.servicos);
                utils.save(STORAGE_KEYS.BARBEIROS, state.barbeiros);
                utils.save(STORAGE_KEYS.CONFIG, state.config);
                return;
            } catch (e) {
                if (handle401(e)) return;
                console.warn('syncData via API falhou, usando localStorage', e.message || e);
            }
        }
        // fallback localStorage
        state.agendamentos = utils.load(STORAGE_KEYS.AGENDAMENTOS, []);
        state.servicos = utils.load(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
        state.barbeiros = utils.load(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);
        state.config = utils.load(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
        if (!localStorage.getItem(STORAGE_KEYS.SERVICOS)) utils.save(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
        if (!localStorage.getItem(STORAGE_KEYS.BARBEIROS)) utils.save(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);
        if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) utils.save(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    }

    // --- NAVEGAÇÃO ---
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', async () => {
                const section = item.getAttribute('data-section');
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
                const target = document.getElementById(section);
                if (target) target.classList.add('active');
                state.currentSection = section;
                const titles = {
                    dashboard: { t: 'Dashboard', s: 'Visão geral do seu negócio' },
                    agendamentos: { t: 'Agendamentos', s: 'Gerencie as reservas de clientes' },
                    servicos: { t: 'Serviços', s: 'Configure preços e durações' },
                    barbeiros: { t: 'Barbeiros', s: 'Gestão da equipe profissional' },
                    configuracoes: { t: 'Configurações', s: 'Ajustes do sistema e horários' }
                };
                const titleEl = document.getElementById('section-title');
                const subEl = document.getElementById('section-subtitle');
                if (titleEl) titleEl.textContent = titles[section].t;
                if (subEl) subEl.textContent = titles[section].s;
                await renderSection();
            });
        });
    }

    async function renderSection() {
        switch (state.currentSection) {
            case 'dashboard': await renderDashboard(); break;
            case 'agendamentos': renderAppointments(); break;
            case 'servicos': renderServices(); break;
            case 'barbeiros': renderBarbers(); break;
            case 'configuracoes': renderSettings(); break;
        }
    }

    // --- DASHBOARD ---
    async function renderDashboard() {
        // Tenta endpoint agregado quando disponível
        if (USE_API) {
            try {
                const dash = await API.getDashboard();
                document.getElementById('stat-hoje').textContent = dash.hoje ?? 0;
                document.getElementById('stat-semana').textContent = dash.semana ?? 0;
                document.getElementById('stat-mes').textContent = dash.mes ?? 0;
                const elCancel = document.getElementById('stat-cancelados');
                if (elCancel) elCancel.textContent = dash.cancelados ?? 0;
                document.getElementById('stat-receita').textContent = utils.formatCurrency(dash.receita ?? 0);
                const chart = document.getElementById('agenda-chart');
                chart.innerHTML = '';
                const porDia = dash.porDiaSemana || [0,0,0,0,0,0];
                const max = Math.max(...porDia, 1);
                porDia.forEach(count => {
                    const bar = document.createElement('div');
                    bar.className = 'chart-bar';
                    bar.style.height = `${(count / max) * 100}%`;
                    bar.setAttribute('data-value', count);
                    chart.appendChild(bar);
                });
                return;
            } catch (e) {
                if (handle401(e)) return;
                // cai para cálculo local
            }
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataHojeISO = hoje.toISOString().split('T')[0];
        const agendamentosHoje = state.agendamentos.filter(a => a.data === dataHojeISO).length;
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 7);
        const agendamentosSemana = state.agendamentos.filter(a => new Date(a.data) >= seteDiasAtras).length;
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        const agendamentosMes = state.agendamentos.filter(a => {
            const d = new Date(a.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        }).length;
        // valor pode vir como servico.preco
        const receita = state.agendamentos.reduce((acc, a) => acc + (Number(a.valor ?? a.servico?.preco) || 0), 0);
        document.getElementById('stat-hoje').textContent = agendamentosHoje;
        document.getElementById('stat-semana').textContent = agendamentosSemana;
        document.getElementById('stat-mes').textContent = agendamentosMes;
        document.getElementById('stat-receita').textContent = utils.formatCurrency(receita);
        const chart = document.getElementById('agenda-chart');
        chart.innerHTML = '';
        const diasSemana = [1, 2, 3, 4, 5, 6];
        const counts = diasSemana.map(dia => state.agendamentos.filter(a => new Date(a.data + 'T00:00:00').getDay() === dia).length);
        const max = Math.max(...counts, 1);
        counts.forEach(count => {
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${(count / max) * 100}%`;
            bar.setAttribute('data-value', count);
            chart.appendChild(bar);
        });
    }

    // --- AGENDAMENTOS ---
    function renderAppointments() {
        const searchFilter = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
        const dateFilter = document.getElementById('filter-date')?.value || '';
        const barberFilter = document.getElementById('filter-barber')?.value || 'todos';
        const statusFilter = document.getElementById('filter-status')?.value || 'todos';
        const tableBody = document.getElementById('table-agendamentos');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        let filtered = [...state.agendamentos];
        if (searchFilter) {
            filtered = filtered.filter(a => {
                const nome = (a.cliente?.nome || a.nome || '').toLowerCase();
                const tel = (a.cliente?.telefone || a.telefone || '').toLowerCase();
                const telDigits = tel.replace(/\D/g, '');
                const qDigits = searchFilter.replace(/\D/g, '');
                return nome.includes(searchFilter) || tel.includes(searchFilter) || (qDigits && telDigits.includes(qDigits));
            });
        }
        if (dateFilter) filtered = filtered.filter(a => a.data === dateFilter);
        if (barberFilter !== 'todos') filtered = filtered.filter(a => a.barbeiro === barberFilter);
        if (statusFilter !== 'todos') {
            const sLow = statusFilter.toLowerCase();
            filtered = filtered.filter(a => (a.status || 'agendado').toLowerCase() === sLow);
        }
        filtered.sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">Nenhum agendamento encontrado.</td></tr>';
            return;
        }
        filtered.forEach(a => {
            const row = document.createElement('tr');
            const statusRaw = a.status || 'agendado';
            const statusLabel = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
            const statusClass = `status-${statusRaw.toLowerCase()}`;
            const nome = a.cliente?.nome || a.nome || '';
            const telefone = a.cliente?.telefone || a.telefone || '';
            const servicoNome = a.servico?.nome || a.servico || '';
            row.innerHTML = `
                <td>${utils.formatDateBR(a.data)} <br> <small>${a.horario}</small></td>
                <td>${utils.escaparHTML(nome)}</td>
                <td>${utils.escaparHTML(telefone)}</td>
                <td>${utils.escaparHTML(servicoNome)}</td>
                <td>${utils.escaparHTML(a.barbeiro || '')}</td>
                <td><span class="status-badge ${statusClass}">${utils.escaparHTML(statusLabel)}</span></td>
                <td style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button class="btn-action btn-edit" title="Editar" onclick="adminApp.editAppointment('${a.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action" title="Trocar barbeiro" style="background:#1565c0; color:#fff;" onclick="adminApp.reassignBarber('${a.id}')"><i class="fas fa-user-edit"></i></button>
                    <button class="btn-action btn-complete" title="Confirmar" onclick="adminApp.confirmAppointment('${a.id}')"><i class="fas fa-check-double"></i></button>
                    <button class="btn-action" title="Concluir" style="background:#2e7d32; color:#fff;" onclick="adminApp.updateStatus('${a.id}', 'realizado')"><i class="fas fa-check"></i></button>
                    <button class="btn-action btn-delete" title="Cancelar" onclick="adminApp.cancelAppointment('${a.id}')"><i class="fas fa-times"></i></button>
                    <button class="btn-action btn-delete" title="Excluir" onclick="adminApp.deleteAppointment('${a.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- SERVIÇOS ---
    function renderServices() {
        const tableBody = document.getElementById('table-servicos');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        state.servicos.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${utils.escaparHTML(s.nome)}</td>
                <td>${utils.formatCurrency(s.preco)}</td>
                <td>${s.duracao} min</td>
                <td>
                    <button class="btn-action btn-edit" onclick="adminApp.editService('${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="adminApp.deleteService('${s.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- BARBEIROS ---
    function renderBarbers() {
        const tableBody = document.getElementById('table-barbeiros');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        state.barbeiros.forEach(b => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${utils.escaparHTML(b.nome)}</td>
                <td>${utils.escaparHTML(b.especialidade || '')}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="adminApp.editBarber('${b.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="adminApp.deleteBarber('${b.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function renderExcecoes() {
        const tbody = document.getElementById('table-excecoes');
        if (!tbody) return;
        if (!state.excecoes.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.6;">Nenhuma exceção cadastrada.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        state.excecoes.slice().sort((a,b)=>a.data.localeCompare(b.data)).forEach(ex => {
            const tr = document.createElement('tr');
            const horario = ex.fechado ? '<span style="color:var(--vermelho-indisp)">Fechado</span>' : `${utils.escaparHTML(ex.abertura||'')} – ${utils.escaparHTML(ex.fechamento||'')}`;
            const motivo = utils.escaparHTML(ex.motivo||'');
            tr.innerHTML = `<td>${utils.formatDateBR(ex.data)}</td><td>${horario}</td><td>${motivo}</td><td style="display:flex; gap:6px;"><button class="btn-action btn-edit" onclick="adminApp.editExcecao('${ex.id}')"><i class="fas fa-edit"></i></button><button class="btn-action btn-delete" onclick="adminApp.deleteExcecao('${ex.id}')"><i class="fas fa-trash"></i></button></td>`;
            tbody.appendChild(tr);
        });
    }

    // --- CONFIGURAÇÕES ---
    function renderSettings() {
        const ab = document.getElementById('config-abertura');
        const fe = document.getElementById('config-fechamento');
        const it = document.getElementById('config-intervalo');
        const ls = document.getElementById('config-storage');
        if (ab) ab.value = state.config.abertura;
        if (fe) fe.value = state.config.fechamento;
        if (it) it.value = state.config.intervalo;
        if (ls) ls.checked = state.config.localStorageAtivo;
        document.querySelectorAll('.dia-check').forEach(chk => {
            chk.checked = state.config.diasFuncionamento.includes(parseInt(chk.value));
        });
        renderExcecoes();
    }

    // --- AÇÕES DE DADOS ---
    const adminApp = {
        // abre modal com motivo — ponytail: motivo só persiste se API online; sem API salva no observacoes local
        cancelAppointment(id) {
            document.getElementById('cancel-agendamento-id').value = id;
            const inp = document.getElementById('cancel-motivo'); if (inp) inp.value = '';
            document.getElementById('modal-cancelar')?.classList.remove('oculto');
        },
        async confirmCancel() {
            const id = document.getElementById('cancel-agendamento-id').value;
            const motivo = document.getElementById('cancel-motivo')?.value.trim() || '';
            if (USE_API) {
                try {
                    await API.patchStatus(id, 'cancelado', motivo || undefined);
                    utils.showToast('Agendamento cancelado com sucesso!');
                    document.getElementById('modal-cancelar')?.classList.add('oculto');
                    await syncData(); renderAppointments(); await renderDashboard(); return;
                } catch (e) {
                    if (handle401(e)) return;
                    utils.showToast(e.data?.error || e.message || 'Falha ao cancelar', 'error'); return;
                }
            }
            state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, status: 'cancelado', observacoes: motivo ? ((a.observacoes ? a.observacoes + ' | ' : '') + 'Motivo: ' + motivo) : a.observacoes } : a);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
            utils.showToast('Agendamento cancelado com sucesso!');
            document.getElementById('modal-cancelar')?.classList.add('oculto');
            renderAppointments();
        },
        async confirmAppointment(id) {
            if (USE_API) {
                try { await API.patchStatus(id, 'confirmado'); utils.showToast('Agendamento confirmado!'); await syncData(); renderAppointments(); await renderDashboard(); return; } catch (e) { if (handle401(e)) return; utils.showToast(e.data?.error || e.message || 'Falha ao confirmar', 'error'); return; }
            }
            state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, status: 'confirmado' } : a);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos); utils.showToast('Agendamento confirmado!'); renderAppointments();
        },
        async deleteAppointment(id) {
            if (!confirm('Excluir permanentemente este agendamento?')) return;
            if (USE_API) {
                try { await API.deleteAppointment(id); utils.showToast('Agendamento excluído!'); await syncData(); renderAppointments(); await renderDashboard(); return; } catch (e) { if (handle401(e)) return; utils.showToast(e.data?.error || e.message || 'Falha ao excluir', 'error'); return; }
            }
            state.agendamentos = state.agendamentos.filter(a => a.id !== id);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos); utils.showToast('Agendamento excluído!'); renderAppointments();
        },
        async updateStatus(id, status) {
            const apiStatus = status.toLowerCase(); // realizado / cancelado etc.
            if (USE_API) {
                try {
                    await API.patchStatus(id, apiStatus);
                    utils.showToast(`Status atualizado para ${status}!`);
                    await syncData();
                    renderAppointments();
                    await renderDashboard();
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                    utils.showToast(e.message || 'Falha ao atualizar status', 'error');
                    return;
                }
            }
            state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, status: status } : a);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
            utils.showToast(`Status atualizado para ${status}!`);
            renderAppointments();
        },
        async editAppointment(id) {
            const a = state.agendamentos.find(item => item.id === id);
            if (!a) return;
            const modal = document.getElementById('modal-agendamento');
            document.getElementById('edit-agendamento-id').value = a.id;
            document.getElementById('edit-data').value = a.data;
            document.getElementById('edit-horario').value = a.horario;
            const selBarber = document.getElementById('edit-barbeiro');
            const selServ = document.getElementById('edit-servico');
            const servicoNomeAtual = a.servico?.nome || a.servico || '';
            selBarber.innerHTML = state.barbeiros.map(b => `<option value="${utils.escaparHTML(b.nome)}" ${b.nome === a.barbeiro ? 'selected' : ''}>${utils.escaparHTML(b.nome)}</option>`).join('');
            selServ.innerHTML = state.servicos.map(s => `<option value="${utils.escaparHTML(s.nome)}" ${s.nome === servicoNomeAtual ? 'selected' : ''}>${utils.escaparHTML(s.nome)}</option>`).join('');
            modal.classList.remove('oculto');
            // historico via API
            const wrap = document.getElementById('agendamento-historico');
            const lista = document.getElementById('agendamento-historico-lista');
            if (wrap && lista) {
                wrap.style.display = 'none'; lista.innerHTML = '<p style="opacity:0.6">Carregando...</p>';
                if (USE_API) {
                    try {
                        const logs = await API.getAppointmentLogs(id);
                        if (!logs.length) { lista.innerHTML = '<p style="opacity:0.6">Sem histórico.</p>'; }
                        else {
                            lista.innerHTML = logs.map(l => {
                                const d = l.detalhe ? JSON.stringify(l.detalhe).slice(0,120) : '';
                                return `<div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08)"><b>${utils.escaparHTML(l.acao)}</b> <small style="opacity:0.6">${utils.escaparHTML(l.autor||'')} · ${new Date(l.criadoEm).toLocaleString('pt-BR')}</small><div style="opacity:0.7; word-break:break-all; font-size:0.8em">${utils.escaparHTML(d)}</div></div>`;
                            }).join('');
                        }
                        wrap.style.display = 'block';
                    } catch (_) { wrap.style.display = 'none'; }
                }
            }
        },
        async saveAppointment() {
            const id = document.getElementById('edit-agendamento-id').value;
            const data = document.getElementById('edit-data').value;
            const horario = document.getElementById('edit-horario').value;
            const barbeiro = document.getElementById('edit-barbeiro').value;
            const servicoNome = document.getElementById('edit-servico').value;
            const servicoObj = state.servicos.find(s => s.nome === servicoNome);

            if (USE_API) {
                try {
                    const payload = {
                        data, horario, barbeiro,
                        servico: servicoObj ? { nome: servicoObj.nome, preco: servicoObj.preco, duracao: servicoObj.duracao } : { nome: servicoNome }
                    };
                    await API.updateAppointment(id, payload);
                    utils.showToast('Agendamento atualizado!');
                    document.getElementById('modal-agendamento').classList.add('oculto');
                    await syncData();
                    renderAppointments();
                    await renderDashboard();
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                    const msg = e.data?.error || e.message || 'Falha ao atualizar';
                    utils.showToast(msg, 'error');
                    return;
                }
            }

            const updated = { data, horario, barbeiro, servico: servicoNome };
            // tenta manter valor coerente
            if (servicoObj) updated.valor = servicoObj.preco;
            state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, ...updated } : a);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
            utils.showToast('Agendamento atualizado!');
            document.getElementById('modal-agendamento').classList.add('oculto');
            renderAppointments();
        },
        async deleteService(id) {
            if (!confirm('Excluir este serviço?')) return;
            if (USE_API) {
                try {
                    await API.deleteService(id);
                    utils.showToast('Serviço removido!');
                    await syncData();
                    renderServices();
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                    utils.showToast(e.message || 'Falha ao excluir', 'error');
                    return;
                }
            }
            state.servicos = state.servicos.filter(s => s.id !== id);
            utils.save(STORAGE_KEYS.SERVICOS, state.servicos);
            utils.showToast('Serviço removido!');
            renderServices();
        },
        editService(id) {
            const s = state.servicos.find(item => item.id === id);
            if (!s) return;
            document.getElementById('modal-servico-title').textContent = 'Editar Serviço';
            document.getElementById('servico-id').value = s.id;
            document.getElementById('servico-nome').value = s.nome;
            document.getElementById('servico-preco').value = s.preco;
            document.getElementById('servico-duracao').value = s.duracao;
            document.getElementById('modal-servico').classList.remove('oculto');
        },
        async saveService(e) {
            e.preventDefault();
            const id = document.getElementById('servico-id').value;
            const nome = document.getElementById('servico-nome').value.trim();
            const preco = parseFloat(document.getElementById('servico-preco').value);
            const duracao = parseInt(document.getElementById('servico-duracao').value);
            if (USE_API) {
                try {
                    if (id) await API.updateService(id, { nome, preco, duracao });
                    else await API.createService({ nome, preco, duracao });
                    utils.showToast('Serviço salvo com sucesso!');
                    document.getElementById('modal-servico').classList.add('oculto');
                    await syncData();
                    renderServices();
                    return;
                } catch (err) {
                    if (handle401(err)) return;
                    utils.showToast(err.data?.error || err.message || 'Falha ao salvar serviço', 'error');
                    return;
                }
            }
            const data = { id: id || utils.generateId(), nome, preco, duracao };
            if (id) state.servicos = state.servicos.map(s => s.id === id ? data : s);
            else state.servicos.push(data);
            utils.save(STORAGE_KEYS.SERVICOS, state.servicos);
            utils.showToast('Serviço salvo com sucesso!');
            document.getElementById('modal-servico').classList.add('oculto');
            renderServices();
        },
        async deleteBarber(id) {
            if (!confirm('Excluir este barbeiro?')) return;
            if (USE_API) {
                try {
                    await API.deleteBarber(id);
                    utils.showToast('Barbeiro removido!');
                    await syncData();
                    renderBarbers();
                    // atualiza filtro de barbeiros na aba agendamentos
                    rebuildBarberFilter();
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                    const msg = (e.data && e.data.error) ? e.data.error : (e.message || 'Falha ao excluir');
                    utils.showToast(msg, 'error');
                    return;
                }
            }
            // modo offline: também bloqueia se houver agendamento ativo em memória
            const nomeBarbeiro = state.barbeiros.find(b => b.id === id)?.nome;
            if (nomeBarbeiro) {
                const vinculadosLocal = state.agendamentos.filter(a => a.barbeiro === nomeBarbeiro && ['agendado','confirmado'].includes((a.status||'agendado').toLowerCase())).length;
                if (vinculadosLocal > 0) {
                    utils.showToast(`Não é possível excluir: barbeiro possui ${vinculadosLocal} agendamento(s) ativo(s).`, 'error');
                    return;
                }
            }
            state.barbeiros = state.barbeiros.filter(b => b.id !== id);
            utils.save(STORAGE_KEYS.BARBEIROS, state.barbeiros);
            utils.showToast('Barbeiro removido!');
            renderBarbers();
            rebuildBarberFilter();
        },
        editBarber(id) {
            const b = state.barbeiros.find(item => item.id === id);
            if (!b) return;
            document.getElementById('modal-barbeiro-title').textContent = 'Editar Barbeiro';
            document.getElementById('barbeiro-id').value = b.id;
            document.getElementById('barbeiro-nome').value = b.nome;
            document.getElementById('barbeiro-espec').value = b.especialidade || '';
            document.getElementById('modal-barbeiro').classList.remove('oculto');
        },
        async saveBarber(e) {
            e.preventDefault();
            const id = document.getElementById('barbeiro-id').value;
            const nome = document.getElementById('barbeiro-nome').value.trim();
            const especialidade = document.getElementById('barbeiro-espec').value.trim();
            if (USE_API) {
                try {
                    if (id) await API.updateBarber(id, { nome, especialidade });
                    else await API.createBarber({ nome, especialidade });
                    utils.showToast('Barbeiro salvo com sucesso!');
                    document.getElementById('modal-barbeiro').classList.add('oculto');
                    await syncData();
                    renderBarbers();
                    rebuildBarberFilter();
                    return;
                } catch (err) {
                    if (handle401(err)) return;
                    utils.showToast(err.data?.error || err.message || 'Falha ao salvar barbeiro', 'error');
                    return;
                }
            }
            const data = { id: id || utils.generateId(), nome, especialidade };
            if (id) state.barbeiros = state.barbeiros.map(b => b.id === id ? data : b);
            else state.barbeiros.push(data);
            utils.save(STORAGE_KEYS.BARBEIROS, state.barbeiros);
            utils.showToast('Barbeiro salvo com sucesso!');
            document.getElementById('modal-barbeiro').classList.add('oculto');
            renderBarbers();
            rebuildBarberFilter();
        },
        reassignBarber(id) {
            const a = state.agendamentos.find(item => item.id === id);
            if (!a) return;
            document.getElementById('reassign-agendamento-id').value = id;
            const sel = document.getElementById('reassign-barbeiro');
            const nomes = state.barbeiros.map(b => b.nome);
            // garante que o atual apareça mesmo se barbeiro foi removido
            if (a.barbeiro && !nomes.includes(a.barbeiro)) nomes.unshift(a.barbeiro);
            if (!nomes.length) nomes.push('Sem preferência');
            sel.innerHTML = nomes.map(nome => `<option value="${utils.escaparHTML(nome)}" ${nome === a.barbeiro ? 'selected' : ''}>${utils.escaparHTML(nome)}</option>`).join('');
            document.getElementById('modal-reassign-barbeiro')?.classList.remove('oculto');
        },
        async confirmReassign() {
            const id = document.getElementById('reassign-agendamento-id').value;
            const barbeiro = document.getElementById('reassign-barbeiro').value.trim();
            if (!barbeiro) { utils.showToast('Selecione um barbeiro', 'error'); return; }
            const atual = state.agendamentos.find(x => x.id === id)?.barbeiro;
            if (barbeiro === atual) { document.getElementById('modal-reassign-barbeiro')?.classList.add('oculto'); return; }
            if (USE_API) {
                try {
                    await API.updateAppointment(id, { barbeiro });
                    utils.showToast('Barbeiro alterado!');
                    document.getElementById('modal-reassign-barbeiro')?.classList.add('oculto');
                    await syncData(); renderAppointments(); await renderDashboard(); return;
                } catch (e) {
                    if (handle401(e)) return;
                    utils.showToast(e.data?.error || e.message || 'Falha ao trocar barbeiro', 'error'); return;
                }
            }
            state.agendamentos = state.agendamentos.map(x => x.id === id ? { ...x, barbeiro } : x);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
            utils.showToast('Barbeiro alterado!');
            document.getElementById('modal-reassign-barbeiro')?.classList.add('oculto');
            renderAppointments();
        },
        editExcecao(id) {
            const ex = state.excecoes.find(x => x.id === id);
            if (!ex) return;
            document.getElementById('excecao-id').value = ex.id;
            document.getElementById('excecao-data').value = ex.data;
            document.getElementById('excecao-abertura').value = ex.abertura || '08:00';
            document.getElementById('excecao-fechamento').value = ex.fechamento || '18:00';
            document.getElementById('excecao-motivo').value = ex.motivo || '';
            document.getElementById('excecao-fechado').checked = !!ex.fechado;
            document.getElementById('excecao-abertura').disabled = !!ex.fechado;
            document.getElementById('excecao-fechamento').disabled = !!ex.fechado;
            document.getElementById('excecao-data').disabled = true;
            document.getElementById('btn-cancelar-excecao').style.display = '';
            document.getElementById('btn-salvar-excecao').textContent = 'Atualizar exceção';
            document.getElementById('form-excecao')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
        async deleteExcecao(id) {
            if (!confirm('Remover esta exceção?')) return;
            if (!USE_API || !API.deleteExcecao) { utils.showToast('API offline', 'error'); return; }
            try { await API.deleteExcecao(id); utils.showToast('Exceção removida!'); await syncData(); renderExcecoes(); } catch (e) { if (handle401(e)) return; utils.showToast(e.data?.error || e.message || 'Falha ao remover', 'error'); }
        },
        async refresh() {
            await syncData();
            rebuildBarberFilter();
            await renderSection();
        }
    };

    function rebuildBarberFilter() {
        const selBarber = document.getElementById('filter-barber');
        if (!selBarber) return;
        const cur = selBarber.value;
        selBarber.innerHTML = '<option value="todos">Todos os Barbeiros</option>';
        state.barbeiros.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.nome;
            opt.textContent = b.nome;
            selBarber.appendChild(opt);
        });
        if (cur) selBarber.value = cur;
    }

    // --- EVENTOS GERAIS ---
    function setupEventListeners() {
        document.getElementById('filter-search')?.addEventListener('input', renderAppointments);
        document.getElementById('filter-date')?.addEventListener('change', renderAppointments);
        document.getElementById('filter-barber')?.addEventListener('change', renderAppointments);
        document.getElementById('filter-status')?.addEventListener('change', renderAppointments);
        document.getElementById('sort-date')?.addEventListener('click', renderAppointments);
        document.getElementById('btn-cancelar-confirmar')?.addEventListener('click', () => adminApp.confirmCancel());
        document.getElementById('btn-cancelar-fechar')?.addEventListener('click', () => document.getElementById('modal-cancelar')?.classList.add('oculto'));
        document.getElementById('btn-reassign-confirmar')?.addEventListener('click', () => adminApp.confirmReassign());
        document.getElementById('btn-reassign-fechar')?.addEventListener('click', () => document.getElementById('modal-reassign-barbeiro')?.classList.add('oculto'));

        document.getElementById('btn-novo-servico')?.addEventListener('click', () => {
            document.getElementById('modal-servico-title').textContent = 'Novo Serviço';
            document.getElementById('form-servico').reset();
            document.getElementById('servico-id').value = '';
            document.getElementById('modal-servico').classList.remove('oculto');
        });
        document.getElementById('form-servico')?.addEventListener('submit', adminApp.saveService);

        document.getElementById('btn-novo-barbeiro')?.addEventListener('click', () => {
            document.getElementById('modal-barbeiro-title').textContent = 'Novo Barbeiro';
            document.getElementById('form-barbeiro').reset();
            document.getElementById('barbeiro-id').value = '';
            document.getElementById('modal-barbeiro').classList.remove('oculto');
        });
        document.getElementById('form-barbeiro')?.addEventListener('submit', adminApp.saveBarber);

        document.getElementById('form-edit-agendamento')?.addEventListener('submit', (e) => {
            e.preventDefault();
            adminApp.saveAppointment();
        });

        document.querySelectorAll('.modal-fechar').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-fundo').forEach(m => m.classList.add('oculto'));
            });
        });
        // fechar modal ao clicar no fundo
        document.querySelectorAll('.modal-fundo').forEach(m => {
            m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('oculto'); });
        });

        // Excecoes por data
        document.getElementById('excecao-fechado')?.addEventListener('change', (e) => {
            const dis = e.target.checked;
            document.getElementById('excecao-abertura').disabled = dis;
            document.getElementById('excecao-fechamento').disabled = dis;
        });
        function resetExcecaoForm() {
            document.getElementById('excecao-id').value = '';
            const f = document.getElementById('form-excecao');
            if (f) f.reset();
            const ab = document.getElementById('excecao-abertura');
            const fe = document.getElementById('excecao-fechamento');
            if (ab) { ab.value = '08:00'; ab.disabled = false; }
            if (fe) { fe.value = '18:00'; fe.disabled = false; }
            const dt = document.getElementById('excecao-data');
            if (dt) dt.disabled = false;
            const bc = document.getElementById('btn-cancelar-excecao');
            if (bc) bc.style.display = 'none';
            const bs = document.getElementById('btn-salvar-excecao');
            if (bs) bs.textContent = 'Salvar exceção';
        }
        document.getElementById('btn-cancelar-excecao')?.addEventListener('click', resetExcecaoForm);
        document.getElementById('form-excecao')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('excecao-id').value.trim();
            const data = document.getElementById('excecao-data').value;
            const fechado = document.getElementById('excecao-fechado').checked;
            const abertura = document.getElementById('excecao-abertura').value;
            const fechamento = document.getElementById('excecao-fechamento').value;
            const motivo = document.getElementById('excecao-motivo').value.trim();
            if (!data) { utils.showToast('Informe a data', 'error'); return; }
            if (!USE_API || !API.createExcecao) { utils.showToast('API offline — exceções exigem servidor', 'error'); return; }
            try {
                if (id) {
                    await API.updateExcecao(id, { fechado, abertura: fechado ? null : abertura, fechamento: fechado ? null : fechamento, motivo });
                    utils.showToast('Exceção atualizada!');
                } else {
                    await API.createExcecao({ data, fechado, abertura: fechado ? null : abertura, fechamento: fechado ? null : fechamento, motivo });
                    utils.showToast('Exceção criada!');
                }
                resetExcecaoForm();
                await syncData(); renderExcecoes();
            } catch (err) {
                if (handle401(err)) return;
                const msg = err.data?.error || err.message || 'Falha ao salvar exceção';
                utils.showToast(typeof msg === 'string' ? msg : 'Dados inválidos', 'error');
            }
        });

        document.getElementById('btn-salvar-config')?.addEventListener('click', async () => {
            const dias = [];
            document.querySelectorAll('.dia-check:checked').forEach(chk => dias.push(parseInt(chk.value)));
            const novaConfig = {
                abertura: document.getElementById('config-abertura').value,
                fechamento: document.getElementById('config-fechamento').value,
                intervalo: parseInt(document.getElementById('config-intervalo').value),
                diasFuncionamento: dias,
                localStorageAtivo: document.getElementById('config-storage').checked
            };
            if (USE_API) {
                try {
                    const saved = await API.updateConfig(novaConfig);
                    state.config = { ...state.config, ...saved };
                    utils.save(STORAGE_KEYS.CONFIG, state.config);
                    utils.showToast('Configurações salvas!');
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                    utils.showToast(e.data?.error || e.message || 'Falha ao salvar', 'error');
                    return;
                }
            }
            state.config = novaConfig;
            utils.save(STORAGE_KEYS.CONFIG, state.config);
            utils.showToast('Configurações salvas!');
        });

        // Exportar
        document.getElementById('btn-export-json')?.addEventListener('click', async () => {
            if (USE_API) {
                try {
                    const data = await API.exportJson();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `backup_barbearia_${new Date().toISOString().split('T')[0]}.json`; a.click();
                    URL.revokeObjectURL(url);
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                    // cai para fallback local
                }
            }
            const data = { agendamentos: state.agendamentos, servicos: state.servicos, barbeiros: state.barbeiros, config: state.config };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `backup_barbearia_${new Date().toISOString().split('T')[0]}.json`; a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
            if (USE_API) {
                try {
                    const blob = await API.exportCsvBlob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `agenda_barbearia_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                    URL.revokeObjectURL(url);
                    return;
                } catch (e) {
                    if (handle401(e)) return;
                }
            }
            let csv = 'Data,Hora,Cliente,Telefone,Servico,Barbeiro,Status\n';
            state.agendamentos.forEach(a => {
                const nome = a.cliente?.nome || a.nome || '';
                const tel = a.cliente?.telefone || a.telefone || '';
                const serv = a.servico?.nome || a.servico || '';
                csv += `${a.data},${a.horario},"${nome}","${tel}","${serv}","${a.barbeiro}",${a.status || 'agendado'}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `agenda_barbearia_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
        });
    }

    // --- INICIALIZAÇÃO ---
    async function init() {
        await syncData();
        setupNavigation();
        setupEventListeners();
        rebuildBarberFilter();
        await renderSection();
    }

    window.adminApp = adminApp;

    init();

})();
