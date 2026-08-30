/* ============================================================================
   APLICAÇÃO DA BARBEARIA — AGENDAMENTO ONLINE
   HTML + CSS + JavaScript puro (sem frameworks e sem bibliotecas de calendário)
   ============================================================================

   ---------------------------------------------------------------------------
   NOTA SOBRE PERSISTÊNCIA DE DADOS (leia antes de usar em produção)
   ---------------------------------------------------------------------------
   Este arquivo foi criado como um artefato dentro do Claude.ai. Esse ambiente
   de pré-visualização BLOQUEIA o acesso a localStorage/sessionStorage por
   segurança, então os agendamentos abaixo são guardados em uma variável
   JavaScript em memória (o "banco de dados" pedido no briefing) e são
   perdidos ao recarregar a página DENTRO do Claude.ai.

   Se você baixar este arquivo .html e abri-lo no seu próprio computador ou
   hospedá-lo no seu site, o localStorage funciona normalmente. Para ativar a
   persistência entre recarregamentos, basta descomentar as duas linhas
   marcadas com "🔓" dentro do objeto BancoDeDados logo abaixo.
   ============================================================================ */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. "BANCO DE DADOS" LOCAL (array em memória)
     --------------------------------------------------------------------- */
  const CHAVE_STORAGE = 'barbearia_agendamentos';

  const BancoDeDados = {
    // Lê os agendamentos salvos (retorna null se não houver / não for possível ler)
    carregar() {
      try {
        // 🔓 Descomente a linha abaixo para persistir fora do Claude.ai:
        // const salvos = localStorage.getItem(CHAVE_STORAGE);
        // return salvos ? JSON.parse(salvos) : null;
        return null; // dentro do Claude.ai, sempre começamos com os dados de exemplo
      } catch (erro) {
        console.warn('Não foi possível ler o localStorage, usando dados em memória.', erro);
        return null;
      }
    },
    // Salva a lista de agendamentos (não faz nada dentro do Claude.ai — ver nota acima)
    salvar(agendamentos) {
      try {
        // 🔓 Descomente a linha abaixo para persistir fora do Claude.ai:
        // localStorage.setItem(CHAVE_STORAGE, JSON.stringify(agendamentos));
      } catch (erro) {
        console.warn('Não foi possível salvar no localStorage.', erro);
      }
    }
  };

  /* Utilitário: transforma um Date em string ISO "AAAA-MM-DD" (sem fuso horário) */
  function paraISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /* Utilitário: formata "AAAA-MM-DD" para "DD/MM/AAAA" */
  function paraBR(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /* Garante que uma data de exemplo nunca caia num domingo (barbearia fechada) */
  function pularDomingo(data) {
    const copia = new Date(data);
    while (copia.getDay() === 0) copia.setDate(copia.getDate() + 1);
    return copia;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = pularDomingo(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
  const depoisDeAmanha = pularDomingo(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 2));

  // 3 agendamentos de exemplo pedidos no briefing, já ocupando horários
  let agendamentos = BancoDeDados.carregar() || [
    {
      id: 'AG1001',
      nome: 'João Pereira',
      telefone: '(11) 91234-5678',
      email: 'joao.pereira@email.com',
      servico: 'Corte de Cabelo',
      valor: 40,
      barbeiro: 'Marcos Silva',
      data: paraISO(amanha),
      horario: '10:00',
      data_criacao: new Date().toISOString()
    },
    {
      id: 'AG1002',
      nome: 'Carlos Souza',
      telefone: '(11) 99876-5432',
      email: '',
      servico: 'Corte + Barba',
      valor: 60,
      barbeiro: 'Rafael Souza',
      data: paraISO(amanha),
      horario: '14:00',
      data_criacao: new Date().toISOString()
    },
    {
      id: 'AG1003',
      nome: 'Bruno Andrade',
      telefone: '(11) 98765-1234',
      email: 'bruno.andrade@email.com',
      servico: 'Barba',
      valor: 30,
      barbeiro: 'Diego Santos',
      data: paraISO(depoisDeAmanha),
      horario: '09:00',
      data_criacao: new Date().toISOString()
    }
  ];

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
    const data = localStorage.getItem(chave);
    return data ? JSON.parse(data) : fallback;
  }

  const config = carregarDados(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const HORA_ABERTURA = parseInt(config.abertura.split(':')[0]);
  const HORA_FECHAMENTO = parseInt(config.fechamento.split(':')[0]);

  function gerarHorariosDoDia() {
    const slots = [];
    for (let h = HORA_ABERTURA; h < HORA_FECHAMENTO; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }

  function ehDomingo(data) {
    return data.getDay() === 0;
  }

  function ehDataPassada(data) {
    const comparar = new Date(data);
    comparar.setHours(0, 0, 0, 0);
    return comparar < hoje;
  }

  // Verifica se já existe agendamento para a data (ISO) e horário informados
  function horarioOcupado(dataISO, horario) {
    return agendamentos.some(a => a.data === dataISO && a.horario === horario);
  }

  function agendamentosDoDia(dataISO) {
    return agendamentos.filter(a => a.data === dataISO);
  }

  /* ---------------------------------------------------------------------
     3. ESTADO DA TELA DE AGENDAMENTO
     --------------------------------------------------------------------- */
  const estado = {
    mesAtual: hoje.getMonth(),
    anoAtual: hoje.getFullYear(),
    dataSelecionadaISO: null,
    horarioSelecionado: null
  };

  const nomesMeses = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro'
  ];

  /* ---------------------------------------------------------------------
     4. CALENDÁRIO (construído do zero, sem bibliotecas)
     --------------------------------------------------------------------- */
  const elGradeCalendario = document.getElementById('grade-calendario');
  const elTextoMesAno = document.getElementById('texto-mes-ano');

  function renderizarCalendario() {
    elTextoMesAno.textContent = `${nomesMeses[estado.mesAtual]} de ${estado.anoAtual}`;
    elGradeCalendario.innerHTML = '';

    const primeiroDiaSemana = new Date(estado.anoAtual, estado.mesAtual, 1).getDay();
    const totalDiasNoMes = new Date(estado.anoAtual, estado.mesAtual + 1, 0).getDate();

    // Células vazias antes do dia 1 (para alinhar com o dia da semana correto)
    for (let i = 0; i < primeiroDiaSemana; i++) {
      const vazio = document.createElement('div');
      vazio.className = 'dia-celula vazio';
      elGradeCalendario.appendChild(vazio);
    }

    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
      const dataCelula = new Date(estado.anoAtual, estado.mesAtual, dia);
      const dataISO = paraISO(dataCelula);
      const celula = document.createElement('div');
      celula.className = 'dia-celula';
      celula.textContent = dia;

      const desabilitado = ehDataPassada(dataCelula) || ehDomingo(dataCelula);

      if (desabilitado) {
        celula.classList.add('desabilitado');
        celula.title = ehDomingo(dataCelula) ? 'Fechado aos domingos' : 'Data já passou';
      } else {
        celula.addEventListener('click', () => selecionarData(dataISO, celula));
      }

      if (dataISO === paraISO(hoje)) celula.classList.add('hoje');
      if (dataISO === estado.dataSelecionadaISO) celula.classList.add('selecionado');

      elGradeCalendario.appendChild(celula);
    }
  }

  document.getElementById('mes-anterior').addEventListener('click', () => {
    estado.mesAtual--;
    if (estado.mesAtual < 0) { estado.mesAtual = 11; estado.anoAtual--; }
    renderizarCalendario();
  });
  document.getElementById('mes-seguinte').addEventListener('click', () => {
    estado.mesAtual++;
    if (estado.mesAtual > 11) { estado.mesAtual = 0; estado.anoAtual++; }
    renderizarCalendario();
  });

  /* ---------------------------------------------------------------------
     5. HORÁRIOS DISPONÍVEIS / INDISPONÍVEIS
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

  function renderizarHorarios() {
    if (!estado.dataSelecionadaISO) {
      elAreaHorarios.innerHTML = '<div class="mensagem-sem-data">Selecione uma data no calendário para ver os horários.</div>';
      return;
    }
    const slots = gerarHorariosDoDia();
    const grade = document.createElement('div');
    grade.className = 'horarios-grid';

    slots.forEach(horario => {
      const ocupado = horarioOcupado(estado.dataSelecionadaISO, horario);
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'horario-slot ' + (ocupado ? 'indisponivel' : 'disponivel');
      botao.textContent = horario;
      botao.disabled = ocupado;
      if (!ocupado && horario === estado.horarioSelecionado) botao.classList.add('selecionado');

      if (!ocupado) {
        botao.addEventListener('click', () => {
          estado.horarioSelecionado = horario;
          renderizarHorarios();
          atualizarResumoDataHorario();
          limparErroCampo('campo-data-oculto');
        });
      }
      grade.appendChild(botao);
    });

    elAreaHorarios.innerHTML = '';
    elAreaHorarios.appendChild(grade);
  }

  function atualizarResumoDataHorario() {
    if (estado.dataSelecionadaISO && estado.horarioSelecionado) {
      elResumoDataHorario.value = `${paraBR(estado.dataSelecionadaISO)} às ${estado.horarioSelecionado}`;
    } else if (estado.dataSelecionadaISO) {
      elResumoDataHorario.value = `${paraBR(estado.dataSelecionadaISO)} — escolha um horário`;
    } else {
      elResumoDataHorario.value = '';
    }
  }

  /* ---------------------------------------------------------------------
     6. VALIDAÇÃO E ENVIO DO FORMULÁRIO
     --------------------------------------------------------------------- */
  const form = document.getElementById('form-agendamento');
  const elAreaAlerta = document.getElementById('area-alerta');

  function mostrarErroCampo(idCampo, mensagem) {
    const campo = document.getElementById(idCampo);
    campo.classList.add('invalido');
    if (mensagem) campo.querySelector('.campo-erro').textContent = mensagem;
  }
  function limparErroCampo(idCampo) {
    document.getElementById(idCampo).classList.remove('invalido');
  }
  function limparTodosErros() {
    ['campo-nome','campo-telefone','campo-email','campo-servico','campo-data-oculto']
      .forEach(limparErroCampo);
    elAreaAlerta.innerHTML = '';
  }

  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function validarTelefone(telefone) {
    const digitos = telefone.replace(/\D/g, '');
    return digitos.length >= 10; // DDD + número
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparTodosErros();

    const nome = document.getElementById('input-nome').value.trim();
    const telefone = document.getElementById('input-telefone').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const servicoSelecionado = document.getElementById('select-servico').value;
    const barbeiro = document.getElementById('select-barbeiro').value;

    let valido = true;

    if (!nome || nome.split(' ').filter(Boolean).length < 2) {
      mostrarErroCampo('campo-nome', 'Informe seu nome completo.');
      valido = false;
    }
    if (!validarTelefone(telefone)) {
      mostrarErroCampo('campo-telefone');
      valido = false;
    }
    if (email && !validarEmail(email)) {
      mostrarErroCampo('campo-email');
      valido = false;
    }
    if (!servicoSelecionado) {
      mostrarErroCampo('campo-servico');
      valido = false;
    }
    if (!estado.dataSelecionadaISO || !estado.horarioSelecionado) {
      mostrarErroCampo('campo-data-oculto');
      valido = false;
    }

    if (!valido) {
      elAreaAlerta.innerHTML = '<div class="alerta alerta-erro">⚠️ Verifique os campos destacados em vermelho antes de continuar.</div>';
      return;
    }

    // Revalidação de segurança: garante que a data não é passada/domingo
    // e que o horário não foi ocupado por outra pessoa nos últimos segundos.
    const dataEscolhida = new Date(estado.dataSelecionadaISO + 'T00:00:00');
    if (ehDataPassada(dataEscolhida)) {
      elAreaAlerta.innerHTML = '<div class="alerta alerta-erro">❌ Não é possível agendar em uma data que já passou.</div>';
      return;
    }
    if (ehDomingo(dataEscolhida)) {
      elAreaAlerta.innerHTML = '<div class="alerta alerta-erro">❌ Estamos fechados aos domingos. Escolha outro dia.</div>';
      return;
    }
    if (horarioOcupado(estado.dataSelecionadaISO, estado.horarioSelecionado)) {
      elAreaAlerta.innerHTML = `<div class="alerta alerta-erro">❌ Horário indisponível! Já existe um agendamento para ${paraBR(estado.dataSelecionadaISO)} às ${estado.horarioSelecionado}.</div>`;
      renderizarHorarios(); // atualiza a grade, pois o horário acabou de ser ocupado
      return;
    }

    const [servicoNome, servicoValor] = servicoSelecionado.split('|');

    const novoAgendamento = {
      id: 'AG' + Date.now(),
      nome, telefone, email,
      servico: servicoNome,
      valor: Number(servicoValor),
      barbeiro,
      data: estado.dataSelecionadaISO,
      horario: estado.horarioSelecionado,
      data_criacao: new Date().toISOString()
    };

    agendamentos.push(novoAgendamento);
    BancoDeDados.salvar(agendamentos);

    exibirConfirmacao(novoAgendamento);
  });

  /* ---------------------------------------------------------------------
     7. TELA DE CONFIRMAÇÃO
     --------------------------------------------------------------------- */
  const elVistaFormulario = document.getElementById('vista-formulario');
  const elVistaConfirmacao = document.getElementById('vista-confirmacao');
  const elResumoConfirmacao = document.getElementById('resumo-confirmacao');

  function exibirConfirmacao(agendamento) {
    elResumoConfirmacao.innerHTML = `
      <div class="resumo-linha"><span>Nome</span><span>${escaparHTML(agendamento.nome)}</span></div>
      <div class="resumo-linha"><span>Serviço</span><span>${escaparHTML(agendamento.servico)}</span></div>
      <div class="resumo-linha"><span>Barbeiro</span><span>${escaparHTML(agendamento.barbeiro)}</span></div>
      <div class="resumo-linha"><span>Data</span><span>${paraBR(agendamento.data)}</span></div>
      <div class="resumo-linha"><span>Horário</span><span>${agendamento.horario}</span></div>
      <div class="resumo-linha"><span>Valor</span><span>R$ ${agendamento.valor},00</span></div>
    `;
    elVistaFormulario.classList.add('oculto');
    elVistaConfirmacao.classList.remove('oculto');
    elVistaConfirmacao.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('btn-voltar-inicio').addEventListener('click', () => {
    // Reseta o formulário e o estado para permitir um novo agendamento
    form.reset();
    estado.dataSelecionadaISO = null;
    estado.horarioSelecionado = null;
    limparTodosErros();
    renderizarCalendario();
    renderizarHorarios();
    atualizarResumoDataHorario();
    elVistaConfirmacao.classList.add('oculto');
    elVistaFormulario.classList.remove('oculto');
    window.location.hash = '#inicio';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------------------
     8. MODAL "MEUS AGENDAMENTOS" (buscar e cancelar por telefone)
     --------------------------------------------------------------------- */
  const modal = document.getElementById('modal-meus-agendamentos');
  const elListaAgendamentosCliente = document.getElementById('lista-agendamentos-cliente');

  function normalizarTelefone(telefone) {
    return telefone.replace(/\D/g, '');
  }

  document.getElementById('link-meus-agendamentos').addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.remove('oculto');
  });
  document.getElementById('fechar-modal').addEventListener('click', () => modal.classList.add('oculto'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('oculto'); });

  document.getElementById('btn-buscar-agendamentos').addEventListener('click', () => {
    const telefoneBusca = normalizarTelefone(document.getElementById('input-busca-telefone').value);
    if (!telefoneBusca) {
      elListaAgendamentosCliente.innerHTML = '<p class="mensagem-sem-data">Digite um telefone para buscar.</p>';
      return;
    }
    const encontrados = agendamentos.filter(a => normalizarTelefone(a.telefone) === telefoneBusca);
    renderizarListaCliente(encontrados);
  });

  function renderizarListaCliente(lista) {
    if (lista.length === 0) {
      elListaAgendamentosCliente.innerHTML = '<p class="mensagem-sem-data">Nenhum agendamento encontrado para esse telefone.</p>';
      return;
    }
    elListaAgendamentosCliente.innerHTML = '';
    lista
      .slice()
      .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario))
      .forEach(a => {
        const item = document.createElement('div');
        item.className = 'item-agendamento';
        item.innerHTML = `
          <div class="info">
            <b>${escaparHTML(a.servico)} — ${paraBR(a.data)} às ${a.horario}</b>
            <span>Barbeiro: ${escaparHTML(a.barbeiro)} · R$ ${a.valor},00</span>
          </div>
          <button type="button" class="btn-cancelar" data-id="${a.id}">Cancelar</button>
        `;
        elListaAgendamentosCliente.appendChild(item);
      });

    elListaAgendamentosCliente.querySelectorAll('.btn-cancelar').forEach(botao => {
      botao.addEventListener('click', () => {
        const id = botao.getAttribute('data-id');
        agendamentos = agendamentos.filter(a => a.id !== id);
        BancoDeDados.salvar(agendamentos);
        const telefoneBusca = normalizarTelefone(document.getElementById('input-busca-telefone').value);
        renderizarListaCliente(agendamentos.filter(a => normalizarTelefone(a.telefone) === telefoneBusca));
        renderizarHorarios(); // libera o horário no calendário de agendamento, se estiver aberto
        renderizarCalendario();
      });
    });
  }

  /* ---------------------------------------------------------------------
     9. MENU MOBILE
     --------------------------------------------------------------------- */
  const btnMenuMobile = document.getElementById('btn-menu-mobile');
  const menuLinks = document.getElementById('menu-links');
  btnMenuMobile.addEventListener('click', () => {
    btnMenuMobile.classList.toggle('aberto');
    menuLinks.classList.toggle('aberto');
  });
  document.querySelectorAll('.fechar-menu').forEach(link => {
    link.addEventListener('click', () => {
      btnMenuMobile.classList.remove('aberto');
      menuLinks.classList.remove('aberto');
    });
  });

  /* ---------------------------------------------------------------------
     10. ANIMAÇÃO DE ENTRADA AO ROLAR A PÁGINA
     --------------------------------------------------------------------- */
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('visivel');
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.revelar').forEach(el => observador.observe(el));

  /* ---------------------------------------------------------------------
     11. INICIALIZAÇÃO
     --------------------------------------------------------------------- */
  function popularOpcoesDinamicas() {
    const servicos = carregarDados(STORAGE_KEYS.SERVICOS, DEFAULT_SERVICOS);
    const barbeiros = carregarDados(STORAGE_KEYS.BARBEIROS, DEFAULT_BARBEIROS);

    const selServico = document.getElementById('select-servico');
    const selBarbeiro = document.getElementById('select-barbeiro');

    if (selServico) {
      selServico.innerHTML = '<option value="" disabled selected>Selecione um serviço</option>';
      servicos.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${s.nome}|${s.preco}`;
        opt.textContent = `${s.nome} — R$ ${s.preco}`;
        selServico.appendChild(opt);
      });
    }

    if (selBarbeiro) {
      selBarbeiro.innerHTML = '<option value="Sem preferência" selected>Sem preferência</option>';
      barbeiros.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.nome;
        opt.textContent = b.nome;
        selBarbeiro.appendChild(opt);
      });
    }
  }

  document.getElementById('ano-atual').textContent = new Date().getFullYear();
  popularOpcoesDinamicas();
  renderizarCalendario();
  renderizarHorarios();

})();