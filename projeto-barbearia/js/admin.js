/* ==========================================================================
   LÓGICA DO PAINEL ADMINISTRATIVO
   ========================================================================== */

(function () {
    'use strict';

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
        diasFuncionamento: [1, 2, 3, 4, 5, 6], // Seg a Sáb
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
        currentSection: 'dashboard'
    };

    // --- UTILITÁRIOS ---
    const utils = {
        save(key, data) {
            localStorage.setItem(key, JSON.stringify(data));
        },
        load(key, fallback) {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
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
            return 'ID_' + Math.random().toString(36).substr(2, 9);
        },
        showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
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

    // --- GESTÃO DE DADOS ---
    function syncData() {
        state.agendamentos = utils.load(STORAGE_KEYS.AGENDAMENTOS, []);
        state.servicos = utils.load(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
        state.barbeiros = utils.load(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);
        state.config = utils.load(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);

        // Se for a primeira vez, salva os defaults
        if (!localStorage.getItem(STORAGE_KEYS.SERVICOS)) utils.save(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
        if (!localStorage.getItem(STORAGE_KEYS.BARBEIROS)) utils.save(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);
        if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) utils.save(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    }

    // --- NAVEGAÇÃO ---
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');

                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
                document.getElementById(section).classList.add('active');

                state.currentSection = section;

                // Atualiza Títulos
                const titles = {
                    dashboard: { t: 'Dashboard', s: 'Visão geral do seu negócio' },
                    agendamentos: { t: 'Agendamentos', s: 'Gerencie as reservas de clientes' },
                    servicos: { t: 'Serviços', s: 'Configure preços e durações' },
                    barbeiros: { t: 'Barbeiros', s: 'Gestão da equipe profissional' },
                    configuracoes: { t: 'Configurações', s: 'Ajustes do sistema e horários' }
                };
                document.getElementById('section-title').textContent = titles[section].t;
                document.getElementById('section-subtitle').textContent = titles[section].s;

                renderSection();
            });
        });
    }

    function renderSection() {
        switch (state.currentSection) {
            case 'dashboard': renderDashboard(); break;
            case 'agendamentos': renderAppointments(); break;
            case 'servicos': renderServices(); break;
            case 'barbeiros': renderBarbers(); break;
            case 'configuracoes': renderSettings(); break;
        }
    }

    // --- DASHBOARD ---
    function renderDashboard() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dataHojeISO = hoje.toISOString().split('T')[0];

        // Stats
        const agendamentosHoje = state.agendamentos.filter(a => a.data === dataHojeISO).length;

        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 7);
        const agendamentosSemana = state.agendamentos.filter(a => new Date(a.data) >= seteDiasAtras).length;

        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        const agendamentosMes = state.agendamentos.filter(a => {
            const d = new Date(a.data);
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        }).length;

        const receita = state.agendamentos.reduce((acc, a) => acc + (Number(a.valor) || 0), 0);

        document.getElementById('stat-hoje').textContent = agendamentosHoje;
        document.getElementById('stat-semana').textContent = agendamentosSemana;
        document.getElementById('stat-mes').textContent = agendamentosMes;
        document.getElementById('stat-receita').textContent = utils.formatCurrency(receita);

        // Gráfico Simples
        const chart = document.getElementById('agenda-chart');
        chart.innerHTML = '';

        const diasSemana = [1, 2, 3, 4, 5, 6]; // Seg-Sáb
        const counts = diasSemana.map(dia => {
            return state.agendamentos.filter(a => new Date(a.data).getDay() === dia).length;
        });

        const max = Math.max(...counts, 1);

        counts.forEach(count => {
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            const height = (count / max) * 100;
            bar.style.height = `${height}%`;
            bar.setAttribute('data-value', count);
            chart.appendChild(bar);
        });
    }

    // --- AGENDAMENTOS ---
    function renderAppointments() {
        const dateFilter = document.getElementById('filter-date').value;
        const barberFilter = document.getElementById('filter-barber').value;
        const statusFilter = document.getElementById('filter-status').value;

        const tableBody = document.getElementById('table-agendamentos');
        tableBody.innerHTML = '';

        let filtered = [...state.agendamentos];

        if (dateFilter) filtered = filtered.filter(a => a.data === dateFilter);
        if (barberFilter !== 'todos') filtered = filtered.filter(a => a.barbeiro === barberFilter);
        if (statusFilter !== 'todos') filtered = filtered.filter(a => a.status === statusFilter);

        // Ordenação simples por data/hora
        filtered.sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">Nenhum agendamento encontrado.</td></tr>';
            return;
        }

        filtered.forEach(a => {
            const row = document.createElement('tr');
            const statusClass = `status-${(a.status || 'Confirmado').toLowerCase()}`;

            row.innerHTML = `
                <td>${utils.formatDateBR(a.data)} <br> <small>${a.horario}</small></td>
                <td>${utils.escaparHTML(a.nome)}</td>
                <td>${utils.escaparHTML(a.telefone)}</td>
                <td>${utils.escaparHTML(a.servico)}</td>
                <td>${utils.escaparHTML(a.barbeiro)}</td>
                <td><span class="status-badge ${statusClass}">${a.status || 'Confirmado'}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="adminApp.editAppointment('${a.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-complete" onclick="adminApp.updateStatus('${a.id}', 'Concluído')"><i class="fas fa-check"></i></button>
                    <button class="btn-action btn-delete" onclick="adminApp.cancelAppointment('${a.id}')"><i class="fas fa-times"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- SERVIÇOS ---
    function renderServices() {
        const tableBody = document.getElementById('table-servicos');
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
        tableBody.innerHTML = '';

        state.barbeiros.forEach(b => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${utils.escaparHTML(b.nome)}</td>
                <td>${utils.escaparHTML(b.especialidade)}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="adminApp.editBarber('${b.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="adminApp.deleteBarber('${b.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- CONFIGURAÇÕES ---
    function renderSettings() {
        document.getElementById('config-abertura').value = state.config.abertura;
        document.getElementById('config-fechamento').value = state.config.fechamento;
        document.getElementById('config-intervalo').value = state.config.intervalo;
        document.getElementById('config-storage').checked = state.config.localStorageAtivo;

        const checks = document.querySelectorAll('.dia-check');
        checks.forEach(chk => {
            chk.checked = state.config.diasFuncionamento.includes(parseInt(chk.value));
        });
    }

    // --- AÇÕES DE DADOS ---
    const adminApp = {
        cancelAppointment(id) {
            if (confirm('Deseja realmente cancelar este agendamento?')) {
                state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, status: 'Cancelado' } : a);
                utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
                utils.showToast('Agendamento cancelado com sucesso!');
                renderAppointments();
            }
        },
        updateStatus(id, status) {
            state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, status: status } : a);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
            utils.showToast(`Status atualizado para ${status}!`);
            renderAppointments();
        },
        editAppointment(id) {
            const a = state.agendamentos.find(item => item.id === id);
            if (!a) return;

            const modal = document.getElementById('modal-agendamento');
            document.getElementById('edit-agendamento-id').value = a.id;
            document.getElementById('edit-data').value = a.data;
            document.getElementById('edit-horario').value = a.horario;

            // Preencher selects de barbeiros e serviços
            const selBarber = document.getElementById('edit-barbeiro');
            const selServ = document.getElementById('edit-servico');
            selBarber.innerHTML = state.barbeiros.map(b => `<option value="${b.nome}" ${b.nome === a.barbeiro ? 'selected' : ''}>${b.nome}</option>`).join('');
            selServ.innerHTML = state.servicos.map(s => `<option value="${s.nome}" ${s.nome === a.servico ? 'selected' : ''}>${s.nome}</option>`).join('');

            modal.classList.remove('oculto');
        },
        saveAppointment() {
            const id = document.getElementById('edit-agendamento-id').value;
            const updated = {
                data: document.getElementById('edit-data').value,
                horario: document.getElementById('edit-horario').value,
                barbeiro: document.getElementById('edit-barbeiro').value,
                servico: document.getElementById('edit-servico').value
            };

            state.agendamentos = state.agendamentos.map(a => a.id === id ? { ...a, ...updated } : a);
            utils.save(STORAGE_KEYS.AGENDAMENTOS, state.agendamentos);
            utils.showToast('Agendamento atualizado!');
            document.getElementById('modal-agendamento').classList.add('oculto');
            renderAppointments();
        },
        deleteService(id) {
            if (confirm('Excluir este serviço?')) {
                state.servicos = state.servicos.filter(s => s.id !== id);
                utils.save(STORAGE_KEYS.SERVICOS, state.servicos);
                utils.showToast('Serviço removido!');
                renderServices();
            }
        },
        editService(id) {
            const s = state.servicos.find(item => item.id === id);
            document.getElementById('modal-servico-title').textContent = 'Editar Serviço';
            document.getElementById('servico-id').value = s.id;
            document.getElementById('servico-nome').value = s.nome;
            document.getElementById('servico-preco').value = s.preco;
            document.getElementById('servico-duracao').value = s.duracao;
            document.getElementById('modal-servico').classList.remove('oculto');
        },
        saveService(e) {
            e.preventDefault();
            const id = document.getElementById('servico-id').value;
            const data = {
                id: id || utils.generateId(),
                nome: document.getElementById('servico-nome').value,
                preco: parseFloat(document.getElementById('servico-preco').value),
                duracao: parseInt(document.getElementById('servico-duracao').value)
            };

            if (id) {
                state.servicos = state.servicos.map(s => s.id === id ? data : s);
            } else {
                state.servicos.push(data);
            }

            utils.save(STORAGE_KEYS.SERVICOS, state.servicos);
            utils.showToast('Serviço salvo com sucesso!');
            document.getElementById('modal-servico').classList.add('oculto');
            renderServices();
        },
        deleteBarber(id) {
            if (confirm('Excluir este barbeiro?')) {
                state.barbeiros = state.barbeiros.filter(b => b.id !== id);
                utils.save(STORAGE_KEYS.BARBEIROS, state.barbeiros);
                utils.showToast('Barbeiro removido!');
                renderBarbers();
            }
        },
        editBarber(id) {
            const b = state.barbeiros.find(item => item.id === id);
            document.getElementById('modal-barbeiro-title').textContent = 'Editar Barbeiro';
            document.getElementById('barbeiro-id').value = b.id;
            document.getElementById('barbeiro-nome').value = b.nome;
            document.getElementById('barbeiro-espec').value = b.especialidade;
            document.getElementById('modal-barbeiro').classList.remove('oculto');
        },
        saveBarber(e) {
            e.preventDefault();
            const id = document.getElementById('barbeiro-id').value;
            const data = {
                id: id || utils.generateId(),
                nome: document.getElementById('barbeiro-nome').value,
                especialidade: document.getElementById('barbeiro-espec').value
            };

            if (id) {
                state.barbeiros = state.barbeiros.map(b => b.id === id ? data : b);
            } else {
                state.barbeiros.push(data);
            }

            utils.save(STORAGE_KEYS.BARBEIROS, state.barbeiros);
            utils.showToast('Barbeiro salvo com sucesso!');
            document.getElementById('modal-barbeiro').classList.add('oculto');
            renderBarbers();
        }
    };

    // --- EVENTOS GERAIS ---
    function setupEventListeners() {
        // Filtros Agendamentos
        document.getElementById('filter-date').addEventListener('change', renderAppointments);
        document.getElementById('filter-barber').addEventListener('change', renderAppointments);
        document.getElementById('filter-status').addEventListener('change', renderAppointments);
        document.getElementById('sort-date').addEventListener('click', renderAppointments);

        // Modais de Serviço
        document.getElementById('btn-novo-servico').addEventListener('click', () => {
            document.getElementById('modal-servico-title').textContent = 'Novo Serviço';
            document.getElementById('form-servico').reset();
            document.getElementById('servico-id').value = '';
            document.getElementById('modal-servico').classList.remove('oculto');
        });

        document.getElementById('form-servico').addEventListener('submit', adminApp.saveService);

        // Modais de Barbeiro
        document.getElementById('btn-novo-barbeiro').addEventListener('click', () => {
            document.getElementById('modal-barbeiro-title').textContent = 'Novo Barbeiro';
            document.getElementById('form-barbeiro').reset();
            document.getElementById('barbeiro-id').value = '';
            document.getElementById('modal-barbeiro').classList.remove('oculto');
        });

        document.getElementById('form-barbeiro').addEventListener('submit', adminApp.saveBarber);

        // Modal de Agendamento (Editar)
        document.getElementById('form-edit-agendamento').addEventListener('submit', (e) => {
            e.preventDefault();
            adminApp.saveAppointment();
        });

        // Fechar Modais
        document.querySelectorAll('.modal-fechar').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-fundo').forEach(m => m.classList.add('oculto'));
            });
        });

        // Configurações
        document.getElementById('btn-salvar-config').addEventListener('click', () => {
            const dias = [];
            document.querySelectorAll('.dia-check:checked').forEach(chk => dias.push(parseInt(chk.value)));

            state.config = {
                abertura: document.getElementById('config-abertura').value,
                fechamento: document.getElementById('config-fechamento').value,
                intervalo: parseInt(document.getElementById('config-intervalo').value),
                diasFuncionamento: dias,
                localStorageAtivo: document.getElementById('config-storage').checked
            };
            utils.save(STORAGE_KEYS.CONFIG, state.config);
            utils.showToast('Configurações salvas!');
        });

        // Exportar
        document.getElementById('btn-export-json').addEventListener('click', () => {
            const data = {
                agendamentos: state.agendamentos,
                servicos: state.servicos,
                barbeiros: state.barbeiros,
                config: state.config
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_barbearia_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        });

        document.getElementById('btn-export-csv').addEventListener('click', () => {
            let csv = 'Data,Hora,Cliente,Telefone,Servico,Barbeiro,Status\n';
            state.agendamentos.forEach(a => {
                csv += `${a.data},${a.horario},"${a.nome}","${a.telefone}","${a.servico}","${a.barbeiro}",${a.status || 'Confirmado'}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agenda_barbearia_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        });
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        syncData();
        setupNavigation();
        setupEventListeners();

        // Popula filtros de barbeiros
        const selBarber = document.getElementById('filter-barber');
        state.barbeiros.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.nome;
            opt.textContent = b.nome;
            selBarber.appendChild(opt);
        });

        renderSection();
    }

    // Expõe funções para o HTML (onclick)
    window.adminApp = adminApp;

    init();

})();
