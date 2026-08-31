/* ============================================================================
   APLICAÇÃO DA BARBEARIA — AGENDAMENTO ONLINE
   Integração com API REST (server/src) + fallback localStorage.
   ============================================================================ */

(function () {
  'use strict';

  const API = window.API || null;
  const USE_API = !!API;

  /* ---------------------------------------------------------------------
     1. PERSISTÊNCIA LEGADA (fallback se API offline)
     --------------------------------------------------------------------- */
  const CHAVE_STORAGE = 'barbearia_agendamentos';

  const BancoDeDados = {
    carregar() {
      try {
        const salvos = localStorage.getItem(CHAVE_STORAGE);
        return salvos ? JSON.parse(salvos) : null;
      } catch (erro) {
        console.warn('Não foi possível ler o localStorage', erro);
        return null;
      }
    },
    salvar(agendamentos) {
      try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(agendamentos));
      } catch (erro) {
        console.warn('Não foi possível salvar no localStorage.', erro);
      }
    }
  };

  function paraISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  function paraBR(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  function pularDomingo(data) {
    const copia = new Date(data);
    while (copia.getDay() === 0) copia.setDate(copia.getDate() + 1);
    return copia;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = pularDomingo(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
  const depoisDeAmanha = pularDomingo(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 2));

  const AGENDAMENTOS_EXEMPLO = [
    { id: 'AG1001', nome: 'João Pereira', telefone: '(11) 91234-5678', email: 'joao.pereira@email.com', servico: 'Corte de Cabelo', valor: 40, barbeiro: 'Marcos Silva', data: paraISO(amanha), horario: '10:00', data_criacao: new Date().toISOString(), status: 'agendado' },
    { id: 'AG1002', nome: 'Carlos Souza', telefone: '(11) 99876-5432', email: '', servico: 'Corte + Barba', valor: 60, barbeiro: 'Rafael Souza', data: paraISO(amanha), horario: '14:00', data_criacao: new Date().toISOString(), status: 'agendado' },
    { id: 'AG1003', nome: 'Bruno Andrade', telefone: '(11) 98765-1234', email: 'bruno.andrade@email.com', servico: 'Barba', valor: 30, barbeiro: 'Diego Santos', data: paraISO(depoisDeAmanha), horario: '09:00', data_criacao: new Date().toISOString(), status: 'agendado' },
  ];

  let agendamentos = [];

  async function carregarAgendamentos() {
    if (USE_API) {
      try {
        const lista = await API.listAppointments();
        // API retorna shape com cliente/servico aninhado + compat flat
        agendamentos = Array.isArray(lista) ? lista : [];
        return;
      } catch (e) {
        console.warn('API offline, usando localStorage fallback', e.message);
      }
    }
    const salvos = BancoDeDados.carregar();
    agendamentos = salvos && salvos.length ? salvos : AGENDAMENTOS_EXEMPLO.slice();
  }

  /* ---------------------------------------------------------------------
     2. REGRAS DE NEGÓCIO / HORÁRIOS
     --------------------------------------------------------------------- */
  const STORAGE_KEYS = {
    AGENDAMENTOS: 'barbearia_agendamentos',
    SERVICOS: 'barbearia_servicos',
    BARBEIROS: 'barbearia_barbeiros',
    CONFIG: 'barbearia_config'
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

  const DEFAULT_CONFIG = {
    abertura: '08:00',
    fechamento: '20:00',
    intervalo: 30,
    diasFuncionamento: [1, 2, 3, 4, 5, 6],
    localStorageAtivo: true
  };

  function carregarDados(chave, fallback) {
    try {
      const data = localStorage.getItem(chave);
      return data ? JSON.parse(data) : fallback;
    } catch (_) { return fallback; }
  }

  let config = carregarDados(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  let HORA_ABERTURA = parseInt(config.abertura.split(':')[0]);
  let HORA_FECHAMENTO = parseInt(config.fechamento.split(':')[0]);
  let INTERVALO = config.intervalo || 30;

  async function carregarConfig() {
    if (USE_API) {
      try {
        const cfg = await API.getConfig();
        config = cfg;
        HORA_ABERTURA = parseInt(cfg.abertura.split(':')[0]);
        HORA_FECHAMENTO = parseInt(cfg.fechamento.split(':')[0]);
        INTERVALO = cfg.intervalo;
        return;
      } catch (_) {}
    }
  }

  function gerarHorariosDoDia() {
    const slots = [];
    for (let h = HORA_ABERTURA; h < HORA_FECHAMENTO; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      if (INTERVALO === 30) slots.push(`${String(h).padStart(2, '0')}:30`);
      else if (INTERVALO === 15) { slots.push(`${String(h).padStart(2, '0')}:15`); slots.push(`${String(h).padStart(2, '0')}:30`); slots.push(`${String(h).padStart(2, '0')}:45`); }
    }
    return slots;
  }

  function ehDomingo(data) { return data.getDay() === 0; }
  function ehDiaFechado(data) { return !config.diasFuncionamento.includes(data.getDay()); }
  function ehDataPassada(data) { const c=new Date(data); c.setHours(0,0,0,0); return c < hoje; }
  function horarioOcupado(dataISO, horario) {
    return agendamentos.some(a => a.data === dataISO && a.horario === horario && a.status !== 'cancelado');
  }
  function agendamentosDoDia(dataISO) { return agendamentos.filter(a => a.data === dataISO); }

  /* ---------------------------------------------------------------------
     3. ESTADO
     --------------------------------------------------------------------- */
  const estado = { mesAtual: hoje.getMonth(), anoAtual: hoje.getFullYear(), dataSelecionadaISO: null, horarioSelecionado: null };
  const nomesMeses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  /* ---------------------------------------------------------------------
     4. CALENDÁRIO
     --------------------------------------------------------------------- */
  const elGradeCalendario = document.getElementById('grade-calendario');
  const elTextoMesAno = document.getElementById('texto-mes-ano');

  function renderizarCalendario() {
    if (!elGradeCalendario || !elTextoMesAno) return;
    elTextoMesAno.textContent = `${nomesMeses[estado.mesAtual]} de ${estado.anoAtual}`;
    elGradeCalendario.innerHTML = '';
    const primeiroDiaSemana = new Date(estado.anoAtual, estado.mesAtual, 1).getDay();
    const totalDiasNoMes = new Date(estado.anoAtual, estado.mesAtual + 1, 0).getDate();
    for (let i = 0; i < primeiroDiaSemana; i++) {
      const vazio = document.createElement('div'); vazio.className = 'dia-celula vazio'; elGradeCalendario.appendChild(vazio);
    }
    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
      const dataCelula = new Date(estado.anoAtual, estado.mesAtual, dia);
      const dataISO = paraISO(dataCelula);
      const celula = document.createElement('div');
      celula.className = 'dia-celula'; celula.textContent = dia;
      const desabilitado = ehDataPassada(dataCelula) || ehDiaFechado(dataCelula);
      if (desabilitado) {
        celula.classList.add('desabilitado');
        celula.title = ehDiaFechado(dataCelula) ? 'Fechado neste dia' : 'Data já passou';
      } else {
        celula.addEventListener('click', () => selecionarData(dataISO, celula));
      }
      if (dataISO === paraISO(hoje)) celula.classList.add('hoje');
      if (dataISO === estado.dataSelecionadaISO) celula.classList.add('selecionado');
      elGradeCalendario.appendChild(celula);
    }
  }
  const btnMesAnterior = document.getElementById('mes-anterior');
  const btnMesSeguinte = document.getElementById('mes-seguinte');
  if (btnMesAnterior) btnMesAnterior.addEventListener('click', () => { estado.mesAtual--; if (estado.mesAtual < 0) { estado.mesAtual = 11; estado.anoAtual--; } renderizarCalendario(); });
  if (btnMesSeguinte) btnMesSeguinte.addEventListener('click', () => { estado.mesAtual++; if (estado.mesAtual > 11) { estado.mesAtual = 0; estado.anoAtual++; } renderizarCalendario(); });

  /* ---------------------------------------------------------------------
     5. HORÁRIOS
     --------------------------------------------------------------------- */
  const elAreaHorarios = document.getElementById('area-horarios');
  const elResumoDataHorario = document.getElementById('resumo-data-horario');

  function selecionarData(dataISO, celulaClicada) {
    estado.dataSelecionadaISO = dataISO;
    estado.horarioSelecionado = null;
    document.querySelectorAll('.dia-celula.selecionado').forEach(c => c.classList.remove('selecionado'));
    celulaClicada.classList.add('selecionado');
    renderizarHorarios();
    atualizarResumoDataHorario();
    limparErroCampo('campo-data-oculto');
  }

  let disponibilidadeCache = null; // { data, intervalos }

  async function renderizarHorarios() {
    if (!elAreaHorarios) return;
    if (!estado.dataSelecionadaISO) {
      elAreaHorarios.innerHTML = '<div class="mensagem-sem-data">Selecione uma data no calendário para ver os horários.</div>';
      return;
    }
    // Tenta buscar disponibilidade da API
    let slots;
    let ocupadosSet = null;
    if (USE_API) {
      try {
        const avail = await API.getAvailability(estado.dataSelecionadaISO);
        disponibilidadeCache = avail;
        if (avail.fechado) {
          elAreaHorarios.innerHTML = '<div class="mensagem-sem-data">Fechado neste dia.</div>';
          return;
        }
        // usa intervalos da API
        const grade = document.createElement('div'); grade.className = 'horarios-grid';
        avail.intervalos.forEach(({ horario, disponivel }) => {
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'horario-slot ' + (disponivel ? 'disponivel' : 'indisponivel');
          botao.textContent = horario; botao.disabled = !disponivel;
          if (disponivel && horario === estado.horarioSelecionado) botao.classList.add('selecionado');
          if (disponivel) botao.addEventListener('click', () => { estado.horarioSelecionado = horario; renderizarHorarios(); atualizarResumoDataHorario(); limparErroCampo('campo-data-oculto'); });
          grade.appendChild(botao);
        });
        elAreaHorarios.innerHTML = ''; elAreaHorarios.appendChild(grade); return;
      } catch (_) { /* fallback local */ }
    }
    // Fallback local
    slots = gerarHorariosDoDia();
    const grade = document.createElement('div'); grade.className = 'horarios-grid';
    slots.forEach(horario => {
      const ocupado = horarioOcupado(estado.dataSelecionadaISO, horario);
      const botao = document.createElement('button');
      botao.type = 'button'; botao.className = 'horario-slot ' + (ocupado ? 'indisponivel' : 'disponivel');
      botao.textContent = horario; botao.disabled = ocupado;
      if (!ocupado && horario === estado.horarioSelecionado) botao.classList.add('selecionado');
      if (!ocupado) botao.addEventListener('click', () => { estado.horarioSelecionado = horario; renderizarHorarios(); atualizarResumoDataHorario(); limparErroCampo('campo-data-oculto'); });
      grade.appendChild(botao);
    });
    elAreaHorarios.innerHTML = ''; elAreaHorarios.appendChild(grade);
  }

  function atualizarResumoDataHorario() {
    if (!elResumoDataHorario) return;
    if (estado.dataSelecionadaISO && estado.horarioSelecionado) elResumoDataHorario.value = `${paraBR(estado.dataSelecionadaISO)} às ${estado.horarioSelecionado}`;
    else if (estado.dataSelecionadaISO) elResumoDataHorario.value = `${paraBR(estado.dataSelecionadaISO)} — escolha um horário`;
    else elResumoDataHorario.value = '';
  }

  /* ---------------------------------------------------------------------
     6. VALIDAÇÃO E ENVIO
     --------------------------------------------------------------------- */
  const form = document.getElementById('form-agendamento');
  const elAreaAlerta = document.getElementById('area-alerta');
  function mostrarErroCampo(idCampo, mensagem) { const campo=document.getElementById(idCampo); if(!campo) return; campo.classList.add('invalido'); if(mensagem){ const err=campo.querySelector('.campo-erro'); if(err) err.textContent=mensagem; } }
  function limparErroCampo(idCampo) { const c=document.getElementById(idCampo); if(c) c.classList.remove('invalido'); }
  function limparTodosErros() { ['campo-nome','campo-telefone','campo-servico','campo-data-oculto'].forEach(limparErroCampo); if(elAreaAlerta) elAreaAlerta.innerHTML=''; }
  function validarTelefone(telefone){ return telefone.replace(/\D/g,'').length >= 10; }

  if (form) form.addEventListener('submit', async function (evento) {
    evento.preventDefault(); limparTodosErros();
    const nome = document.getElementById('input-nome').value.trim();
    const telefone = document.getElementById('input-telefone').value.trim();
    const servicoSelecionado = document.getElementById('select-servico').value;
    const barbeiro = document.getElementById('select-barbeiro').value;
    let valido = true;
    if (!nome || nome.split(' ').filter(Boolean).length < 2) { mostrarErroCampo('campo-nome','Informe seu nome completo.'); valido=false; }
    if (!validarTelefone(telefone)) { mostrarErroCampo('campo-telefone'); valido=false; }
    if (!servicoSelecionado) { mostrarErroCampo('campo-servico'); valido=false; }
    if (!estado.dataSelecionadaISO || !estado.horarioSelecionado) { mostrarErroCampo('campo-data-oculto'); valido=false; }
    if (!valido) { if(elAreaAlerta) elAreaAlerta.innerHTML='<div class="alerta alerta-erro">⚠️ Verifique os campos destacados em vermelho antes de continuar.</div>'; return; }
    const dataEscolhida = new Date(estado.dataSelecionadaISO + 'T00:00:00');
    if (ehDataPassada(dataEscolhida)) { if(elAreaAlerta) elAreaAlerta.innerHTML='<div class="alerta alerta-erro">❌ Não é possível agendar em uma data que já passou.</div>'; return; }
    if (ehDiaFechado(dataEscolhida)) { if(elAreaAlerta) elAreaAlerta.innerHTML='<div class="alerta alerta-erro">❌ Estamos fechados neste dia. Escolha outro dia.</div>'; return; }

    const [servicoNome, servicoValor] = servicoSelecionado.split('|');
    // Tenta criar via API
    if (USE_API) {
      try {
        const payload = {
          cliente: { nome, telefone, email: '' },
          servico: { nome: servicoNome, preco: Number(servicoValor) },
          barbeiro, data: estado.dataSelecionadaISO, horario: estado.horarioSelecionado
        };
        const criado = await API.createAppointment(payload);
        // Atualiza lista local
        agendamentos.push(criado);
        exibirConfirmacao(criado);
        return;
      } catch (err) {
        if (err.status === 409) {
          if(elAreaAlerta) elAreaAlerta.innerHTML=`<div class="alerta alerta-erro">❌ Horário indisponível! Já existe um agendamento para ${paraBR(estado.dataSelecionadaISO)} às ${estado.horarioSelecionado}.</div>`;
          await carregarAgendamentos(); renderizarHorarios(); return;
        }
        if (err.status === 400) {
          if(elAreaAlerta) elAreaAlerta.innerHTML=`<div class="alerta alerta-erro">❌ ${err.data?.error || err.message}</div>`; return;
        }
        // falha de rede — cai para fallback local
        console.warn('Falha ao criar via API, usando fallback local', err);
      }
    }
    // Fallback local (sem API)
    if (horarioOcupado(estado.dataSelecionadaISO, estado.horarioSelecionado)) {
      if(elAreaAlerta) elAreaAlerta.innerHTML=`<div class="alerta alerta-erro">❌ Horário indisponível! Já existe um agendamento para ${paraBR(estado.dataSelecionadaISO)} às ${estado.horarioSelecionado}.</div>`;
      renderizarHorarios(); return;
    }
    const novoAgendamento = { id:'AG'+Date.now(), nome, telefone, email:'', servico:servicoNome, valor:Number(servicoValor), barbeiro, data:estado.dataSelecionadaISO, horario:estado.horarioSelecionado, data_criacao:new Date().toISOString(), status:'agendado' };
    agendamentos.push(novoAgendamento); BancoDeDados.salvar(agendamentos); exibirConfirmacao(novoAgendamento);
  });

  /* ---------------------------------------------------------------------
     7. TELA DE CONFIRMAÇÃO
     --------------------------------------------------------------------- */
  const elVistaFormulario = document.getElementById('vista-formulario');
  const elVistaConfirmacao = document.getElementById('vista-confirmacao');
  const elResumoConfirmacao = document.getElementById('resumo-confirmacao');
  function exibirConfirmacao(agendamento) {
    // compat: agendamento pode vir no shape API (cliente/servico aninhado)
    const nome = agendamento.cliente?.nome || agendamento.nome;
    const servico = agendamento.servico?.nome || agendamento.servico;
    const barbeiro = agendamento.barbeiro;
    const valor = agendamento.servico?.preco ?? agendamento.valor;
    if (elResumoConfirmacao) elResumoConfirmacao.innerHTML = `
      <div class="resumo-linha"><span>Nome</span><span>${escaparHTML(nome)}</span></div>
      <div class="resumo-linha"><span>Serviço</span><span>${escaparHTML(servico)}</span></div>
      <div class="resumo-linha"><span>Barbeiro</span><span>${escaparHTML(barbeiro)}</span></div>
      <div class="resumo-linha"><span>Data</span><span>${paraBR(agendamento.data)}</span></div>
      <div class="resumo-linha"><span>Horário</span><span>${agendamento.horario}</span></div>
      <div class="resumo-linha"><span>Valor</span><span>R$ ${valor},00</span></div>
    `;
    if (elVistaFormulario) elVistaFormulario.classList.add('oculto');
    if (elVistaConfirmacao) { elVistaConfirmacao.classList.remove('oculto'); elVistaConfirmacao.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  const btnVoltarInicio = document.getElementById('btn-voltar-inicio');
  if (btnVoltarInicio) btnVoltarInicio.addEventListener('click', async () => {
    if (form) form.reset(); estado.dataSelecionadaISO=null; estado.horarioSelecionado=null; limparTodosErros();
    await carregarAgendamentos(); renderizarCalendario(); renderizarHorarios(); atualizarResumoDataHorario();
    if (elVistaConfirmacao) elVistaConfirmacao.classList.add('oculto');
    if (elVistaFormulario) elVistaFormulario.classList.remove('oculto');
    window.location.hash='#inicio'; window.scrollTo({ top:0, behavior:'smooth' });
  });
  function escaparHTML(texto){ const div=document.createElement('div'); div.textContent=texto; return div.innerHTML; }

  /* ---------------------------------------------------------------------
     8. MODAL "MEUS AGENDAMENTOS"
     --------------------------------------------------------------------- */
  const modal = document.getElementById('modal-meus-agendamentos');
  const elListaAgendamentosCliente = document.getElementById('lista-agendamentos-cliente');
  function normalizarTelefone(telefone){ return telefone.replace(/\D/g,''); }
  const linkMeus = document.getElementById('link-meus-agendamentos');
  if (linkMeus) linkMeus.addEventListener('click', (e)=>{ e.preventDefault(); if(modal) modal.classList.remove('oculto'); });
  const fecharModal = document.getElementById('fechar-modal');
  if (fecharModal) fecharModal.addEventListener('click', ()=>{ if(modal) modal.classList.add('oculto'); });
  if (modal) modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.add('oculto'); });
  const btnBuscar = document.getElementById('btn-buscar-agendamentos');
  if (btnBuscar) btnBuscar.addEventListener('click', async ()=>{
    const telefoneBusca = normalizarTelefone(document.getElementById('input-busca-telefone').value);
    if(!telefoneBusca){ if(elListaAgendamentosCliente) elListaAgendamentosCliente.innerHTML='<p class="mensagem-sem-data">Digite um telefone para buscar.</p>'; return; }
    let encontrados = [];
    if (USE_API) {
      try {
        const lista = await API.listAppointments({ telefone: telefoneBusca });
        // API filtra por LIKE de dígitos; fallback filtra exato também
        encontrados = lista.filter(a => normalizarTelefone(a.telefone || a.cliente?.telefone || '') === telefoneBusca);
        // se API retornou vazio por normalização, tenta todos e filtra
        if (encontrados.length===0 && lista.length===0) {
          const todos = await API.listAppointments();
          encontrados = todos.filter(a => normalizarTelefone(a.telefone || a.cliente?.telefone || '') === telefoneBusca);
        }
      } catch(e){ encontrados = agendamentos.filter(a => normalizarTelefone(a.telefone || a.cliente?.telefone || '') === telefoneBusca); }
    } else {
      encontrados = agendamentos.filter(a => normalizarTelefone(a.telefone) === telefoneBusca);
    }
    renderizarListaCliente(encontrados);
  });

  function renderizarListaCliente(lista){
    if (!elListaAgendamentosCliente) return;
    // filtra cancelados? mostra todos exceto cancelados? mostra todos e indica status
    const visiveis = lista.filter(a => (a.status || 'agendado') !== 'cancelado');
    if (visiveis.length===0){ elListaAgendamentosCliente.innerHTML='<p class="mensagem-sem-data">Nenhum agendamento encontrado para esse telefone.</p>'; return; }
    elListaAgendamentosCliente.innerHTML='';
    visiveis.slice().sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario)).forEach(a=>{
      const servicoNome = a.servico?.nome || a.servico;
      const barbeiroNome = a.barbeiro;
      const valor = a.servico?.preco ?? a.valor;
      const item=document.createElement('div'); item.className='item-agendamento';
      item.innerHTML=`<div class="info"><b>${escaparHTML(servicoNome)} — ${paraBR(a.data)} às ${a.horario}</b><span>Barbeiro: ${escaparHTML(barbeiroNome)} · R$ ${valor},00</span></div><button type="button" class="btn-cancelar" data-id="${a.id}">Cancelar</button>`;
      elListaAgendamentosCliente.appendChild(item);
    });
    elListaAgendamentosCliente.querySelectorAll('.btn-cancelar').forEach(botao=>{
      botao.addEventListener('click', async ()=>{
        const id=botao.getAttribute('data-id');
        if (!confirm('Deseja cancelar este agendamento?')) return;
        if (USE_API) {
          try {
            const tel = document.getElementById('input-busca-telefone').value;
            // tenta cancel via API (soft cancel com telefone)
            try { await API.cancelAppointment(id, tel); } catch(_) { await API.publicDeleteAppointment(id, normalizarTelefone(tel)); }
          } catch(e){ alert(e.message); return; }
          await carregarAgendamentos();
        } else {
          agendamentos = agendamentos.filter(a=>a.id!==id); BancoDeDados.salvar(agendamentos);
        }
        const telefoneBusca = normalizarTelefone(document.getElementById('input-busca-telefone').value);
        let restantes=[];
        if (USE_API) { try{ const lista=await API.listAppointments({ telefone: telefoneBusca }); restantes=lista.filter(a=>normalizarTelefone(a.telefone||a.cliente?.telefone||'')===telefoneBusca); } catch(_){ restantes=agendamentos.filter(a=>normalizarTelefone(a.telefone||a.cliente?.telefone||'')===telefoneBusca); } }
        else restantes=agendamentos.filter(a=>normalizarTelefone(a.telefone)===telefoneBusca);
        renderizarListaCliente(restantes); renderizarHorarios(); renderizarCalendario();
      });
    });
  }

  /* ---------------------------------------------------------------------
     9. MENU MOBILE
     --------------------------------------------------------------------- */
  const btnMenuMobile = document.getElementById('btn-menu-mobile');
  const menuLinks = document.getElementById('menu-links');
  if (btnMenuMobile && menuLinks) {
    const menuOverlay = document.createElement('div'); menuOverlay.className='menu-overlay'; menuOverlay.id='menu-overlay'; document.body.appendChild(menuOverlay);
    function fecharMenuMobile(){ btnMenuMobile.classList.remove('aberto'); menuLinks.classList.remove('aberto'); menuOverlay.classList.remove('aberto'); document.body.style.overflow=''; }
    function alternarMenuMobile(e){ e.stopPropagation(); const vaiAbrir=!menuLinks.classList.contains('aberto'); btnMenuMobile.classList.toggle('aberto',vaiAbrir); menuLinks.classList.toggle('aberto',vaiAbrir); menuOverlay.classList.toggle('aberto',vaiAbrir); document.body.style.overflow=vaiAbrir?'hidden':''; }
    btnMenuMobile.addEventListener('click', alternarMenuMobile);
    menuOverlay.addEventListener('click', fecharMenuMobile);
    document.querySelectorAll('.fechar-menu').forEach(link=>{ link.addEventListener('click', fecharMenuMobile); });
    document.addEventListener('click', (e)=>{ if(menuLinks.classList.contains('aberto') && !menuLinks.contains(e.target) && e.target!==btnMenuMobile && !btnMenuMobile.contains(e.target)){ if(!menuOverlay.contains(e.target)) fecharMenuMobile(); } });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && menuLinks.classList.contains('aberto')) fecharMenuMobile(); });
    window.addEventListener('resize', ()=>{ if(window.innerWidth>720) fecharMenuMobile(); });
  }

  /* ---------------------------------------------------------------------
     10. ANIMAÇÃO AO ROLAR
     --------------------------------------------------------------------- */
  const observador = new IntersectionObserver((entradas)=>{ entradas.forEach(entrada=>{ if(entrada.isIntersecting){ entrada.target.classList.add('visivel'); observador.unobserve(entrada.target); } }); }, { threshold:0.15 });
  document.querySelectorAll('.revelar').forEach(el=>observador.observe(el));

  /* ---------------------------------------------------------------------
     11. INICIALIZAÇÃO
     --------------------------------------------------------------------- */
  async function popularOpcoesDinamicas(){
    let servicos = null, barbeiros = null;
    if (USE_API) {
      try { servicos = await API.listServices(); } catch(_){}
      try { barbeiros = await API.listBarbers(); } catch(_){}
    }
    if (!servicos || !servicos.length) servicos = carregarDados(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
    if (!barbeiros || !barbeiros.length) barbeiros = carregarDados(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);
    const selServico=document.getElementById('select-servico');
    const selBarbeiro=document.getElementById('select-barbeiro');
    if(selServico){ selServico.innerHTML='<option value="" disabled selected>Selecione um serviço</option>'; servicos.forEach(s=>{ const opt=document.createElement('option'); opt.value=`${s.nome}|${s.preco}`; opt.textContent=`${s.nome} — R$ ${s.preco}`; selServico.appendChild(opt); }); }
    if(selBarbeiro){ selBarbeiro.innerHTML='<option value="Sem preferência" selected>Sem preferência</option>'; barbeiros.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.nome; opt.textContent=b.nome; selBarbeiro.appendChild(opt); }); }
  }

  const elAno = document.getElementById('ano-atual');
  if (elAno) elAno.textContent = new Date().getFullYear();

  (async function init(){
    await carregarConfig();
    await carregarAgendamentos();
    await popularOpcoesDinamicas();
    renderizarCalendario();
    renderizarHorarios();
  })();

})();
