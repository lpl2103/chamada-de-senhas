/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SCRIPT DA RECEPÇÃO & TRIAGEM (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script principal da Recepção (index.html). Suporte ao Nome do Paciente,
 *            Emissão com Impressão Térmica e QR Code para celular.
 * ============================================================================
 */

class StateManager {
  static STORAGE_KEY = 'chama_senha_state_v1';

  constructor() {
    const savedState = this.loadFromStorage();
    this.dailyDate = savedState?.dailyDate ?? new Date().toLocaleDateString('pt-BR');
    this.senhaNormalCount = savedState?.senhaNormalCount ?? 0;
    this.senhaPrioridadedCount = savedState?.senhaPrioridadedCount ?? 0;
    this.senhaAtualText = (savedState?.senhaAtualText && savedState.senhaAtualText !== '0000') ? savedState.senhaAtualText : 'N000';
    this.ultimaSenhaText = (savedState?.ultimaSenhaText && savedState.ultimaSenhaText !== '0000') ? savedState.ultimaSenhaText : 'N000';
    this.guicheAtual = savedState?.guicheAtual ?? 'Recepção';
    this.tipoAtendimento = savedState?.tipoAtendimento ?? 'Aguardando Chamada';
    this.patientNameAtual = savedState?.patientNameAtual ?? '';
    this.queue = savedState?.queue ?? [];
    this.historico = savedState?.historico ?? [];
    this.somHabilitado = savedState?.somHabilitado ?? true;
    this.vozHabilitada = savedState?.vozHabilitada ?? true;

    this.checkDailyAutoReset();
  }

  checkDailyAutoReset() {
    const today = new Date().toLocaleDateString('pt-BR');
    if (this.dailyDate !== today) {
      console.log(`[ChamaSenha]: Novo dia (${today}). Resetando contadores diários...`);
      this.dailyDate = today;
      this.resetState();
    }
  }

  saveToStorage() {
    try {
      const stateToSave = {
        dailyDate: this.dailyDate,
        senhaNormalCount: this.senhaNormalCount,
        senhaPrioridadedCount: this.senhaPrioridadedCount,
        senhaAtualText: this.senhaAtualText,
        ultimaSenhaText: this.ultimaSenhaText,
        guicheAtual: this.guicheAtual,
        tipoAtendimento: this.tipoAtendimento,
        patientNameAtual: this.patientNameAtual,
        queue: this.queue,
        historico: (this.historico || []).slice(0, 3),
        somHabilitado: this.somHabilitado,
        vozHabilitada: this.vozHabilitada
      };
      localStorage.setItem(StateManager.STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[ChamaSenha Error]: Falha ao salvar estado:', error);
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(StateManager.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  resetState() {
    this.senhaNormalCount = 0;
    this.senhaPrioridadedCount = 0;
    this.senhaAtualText = 'N000';
    this.ultimaSenhaText = 'N000';
    this.tipoAtendimento = 'Aguardando Chamada';
    this.patientNameAtual = '';
    this.queue = [];
    this.historico = [];
    this.saveToStorage();
  }
}

function padNumber(num, size) {
  return String(num).padStart(size, '0');
}

class ChamaSenhaApp {
  constructor() {
    this.state = new StateManager();
    this.speechSynth = window.speechSynthesis || null;
    this.socket = null;
    this.broadcastChannel = null;

    this.dom = {
      senhaAtualNumero: document.getElementById('senhaAtualNumero'),
      ultimaSenhaNumero: document.getElementById('ultimaSenhaNumero'),
      displayCard: document.getElementById('displayCard'),
      displayTypeBadge: document.getElementById('displayTypeBadge'),
      displayPatientName: document.getElementById('displayPatientName'),
      currentGuicheBadge: document.getElementById('currentGuicheBadge'),
      historicoLista: document.getElementById('historicoLista'),
      totalQueueCount: document.getElementById('totalQueueCount'),
      queueListContainer: document.getElementById('queueListContainer'),
      issueDestinationSelect: document.getElementById('issueDestinationSelect'),
      issuePatientName: document.getElementById('issuePatientName'),
      btnIssueNormal: document.getElementById('btnIssueNormal'),
      btnIssuePrior: document.getElementById('btnIssuePrior'),
      btnIssueAndPrint: document.getElementById('btnIssueAndPrint'),
      printContainer: document.getElementById('printContainer'),
      audioChamada: document.getElementById('audioChamada'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      speechToggleBtn: document.getElementById('speechToggleBtn'),
      btnProximaNormal: document.getElementById('btnProximaNormal'),
      btnAnteriorNormal: document.getElementById('btnAnteriorNormal'),
      btnProximaPrior: document.getElementById('btnProximaPrior'),
      btnAnteriorPrior: document.getElementById('btnAnteriorPrior'),
      btnRepetir: document.getElementById('btnRepetir'),
      btnReset: document.getElementById('btnReset'),
      confirmResetModal: document.getElementById('confirmResetModal'),
      btnCancelReset: document.getElementById('btnCancelReset'),
      btnConfirmReset: document.getElementById('btnConfirmReset')
    };

    this.init();
  }

  init() {
    this.initTheme();
    this.updateUI();
    this.bindEvents();
    this.initCommunication();
    console.log('[ChamaSenha Recepção]: Inicializado.');
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    this.dom.btnIssueNormal?.addEventListener('click', () => this.emitirSenha('NORMAL'));
    this.dom.btnIssuePrior?.addEventListener('click', () => this.emitirSenha('PRIORIDADE'));
    this.dom.btnIssueAndPrint?.addEventListener('click', () => this.emitirEImprimirSenha());

    this.dom.btnProximaNormal?.addEventListener('click', () => this.chamarProxima('NORMAL'));
    this.dom.btnProximaPrior?.addEventListener('click', () => this.chamarProxima('PRIORIDADE'));
    this.dom.btnRepetir?.addEventListener('click', () => this.repetirChamada());
    this.dom.btnAnteriorNormal?.addEventListener('click', () => this.voltarNormal());
    this.dom.btnAnteriorPrior?.addEventListener('click', () => this.voltarPrioridade());

    this.dom.btnReset?.addEventListener('click', () => this.abrirModalReset());
    this.dom.btnCancelReset?.addEventListener('click', () => this.fecharModalReset());
    this.dom.btnConfirmReset?.addEventListener('click', () => this.executarReset());

    this.dom.themeToggleBtn?.addEventListener('click', () => this.toggleTheme());
    this.dom.soundToggleBtn?.addEventListener('click', () => this.toggleSound());
    this.dom.speechToggleBtn?.addEventListener('click', () => this.toggleSpeech());
  }

  initCommunication() {
    if (window.location.protocol.startsWith('http')) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.updateConnectionStatus(true, 'Conectado ao Servidor (WebSocket)');
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
          } catch (e) {}
        };

        this.socket.onclose = () => {
          this.updateConnectionStatus(false, 'Modo Local (BroadcastChannel)');
          this.setupFallbackChannel();
        };

        this.socket.onerror = () => {
          this.updateConnectionStatus(false, 'Modo Local (BroadcastChannel)');
          this.setupFallbackChannel();
        };
      } catch (err) {
        this.setupFallbackChannel();
      }
    } else {
      this.setupFallbackChannel();
    }
  }

  setupFallbackChannel() {
    if ('BroadcastChannel' in window && !this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel('chama_senha_channel');
      this.broadcastChannel.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };
      this.updateConnectionStatus(true, 'Modo Local (BroadcastChannel)');
    }
  }

  handleIncomingMessage(data) {
    if (!data) return;

    switch (data.type) {
      case 'INIT_STATE':
      case 'TICKET_ISSUED':
      case 'TICKET_CALLED':
      case 'SERVICE_STARTED':
      case 'SERVICE_COMPLETED':
      case 'SERVICE_ABSENT':
      case 'TICKET_REDIRECTED':
      case 'TICKETS_RESET': {
        const payload = data.payload?.state || data.payload;
        if (payload) {
          this.state.senhaNormalCount = payload.senhaNormalCount ?? this.state.senhaNormalCount;
          this.state.senhaPrioridadedCount = payload.senhaPrioridadedCount ?? this.state.senhaPrioridadedCount;
          this.state.senhaAtualText = payload.senhaAtualText ?? this.state.senhaAtualText;
          this.state.ultimaSenhaText = payload.ultimaSenhaText ?? this.state.ultimaSenhaText;
          this.state.guicheAtual = payload.guicheAtual ?? this.state.guicheAtual;
          this.state.tipoAtendimento = payload.tipoAtendimento ?? this.state.tipoAtendimento;
          this.state.patientNameAtual = payload.patientNameAtual ?? this.state.patientNameAtual;
          this.state.queue = payload.queue ?? this.state.queue;
          this.state.historico = payload.historico ?? this.state.historico;
          this.state.saveToStorage();
          this.updateUI();
        }
        break;
      }
      default:
        break;
    }
  }

  sendEvent(eventType, payloadData) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: eventType, payload: payloadData }));
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: eventType, payload: payloadData });
    }
  }

  emitirSenha(tipo) {
    const destination = this.dom.issueDestinationSelect?.value || 'Geral';
    const patientName = this.dom.issuePatientName?.value || '';

    this.sendEvent('ISSUE_TICKET', { type: tipo, destination, patientName });

    if (this.dom.issuePatientName) {
      this.dom.issuePatientName.value = '';
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      let id = '';
      if (tipo === 'PRIORIDADE') {
        this.state.senhaPrioridadedCount += 1;
        id = 'P' + padNumber(this.state.senhaPrioridadedCount, 3);
      } else {
        this.state.senhaNormalCount += 1;
        id = 'N' + padNumber(this.state.senhaNormalCount, 3);
      }

      const tObj = {
        id,
        type: tipo,
        destination,
        patientName: patientName.trim(),
        createdAt: new Date().toISOString(),
        status: 'WAITING'
      };

      this.state.queue.push(tObj);
      this.state.saveToStorage();
      this.updateUI();
    }
  }

  emitirEImprimirSenha() {
    const destination = this.dom.issueDestinationSelect?.value || 'Geral';
    const patientName = (this.dom.issuePatientName?.value || '').trim();

    let newId = '';
    this.state.senhaNormalCount += 1;
    newId = 'N' + padNumber(this.state.senhaNormalCount, 3);

    const ticketObj = {
      id: newId,
      type: 'NORMAL',
      destination,
      patientName,
      createdAt: new Date().toLocaleTimeString('pt-BR')
    };

    this.emitirSenha('NORMAL');
    this.imprimirTicketTermico(ticketObj);
  }

  imprimirTicketTermico(ticketObj) {
    const host = window.location.host || 'localhost:3000';
    const pacienteUrl = `${window.location.protocol}//${host}/paciente.html?ticket=${ticketObj.id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pacienteUrl)}`;

    const printWin = window.open('', '_blank', 'width=350,height=500');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket - ${ticketObj.id}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: monospace, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 5mm;
            text-align: center;
            color: #000;
          }
          .logo { max-width: 120px; margin-bottom: 4px; }
          .title { font-size: 14px; font-weight: bold; }
          .sub { font-size: 11px; margin-bottom: 8px; }
          .ticket-number { font-size: 38px; font-weight: bold; border: 2px dashed #000; padding: 6px; margin: 8px 0; }
          .info { font-size: 12px; margin: 4px 0; text-align: left; }
          .qrcode { margin-top: 10px; width: 110px; height: 110px; }
          .footer-note { font-size: 10px; margin-top: 6px; }
        </style>
      </head>
      <body>
        <img src="imagens/nvzenit.webp" class="logo" />
        <div class="title">ZENIT TECNOLOGIA</div>
        <div class="sub">Sistema de Atendimento</div>
        <hr/>
        <div class="info"><strong>DESTINO:</strong> ${ticketObj.destination}</div>
        ${ticketObj.patientName ? `<div class="info"><strong>PACIENTE:</strong> ${ticketObj.patientName}</div>` : ''}
        <div class="info"><strong>EMISSÃO:</strong> ${ticketObj.createdAt || new Date().toLocaleTimeString('pt-BR')}</div>
        <div class="ticket-number">${ticketObj.id}</div>
        <img src="${qrCodeUrl}" class="qrcode" />
        <div class="footer-note">Escaneie o QR Code para acompanhar no seu celular</div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  chamarProxima(preferredType = '') {
    this.sendEvent('CALL_NEXT', { destination: 'Recepção', preferredType });

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      let index = -1;
      if (preferredType === 'PRIORIDADE') {
        index = this.state.queue.findIndex(t => t.type === 'PRIORIDADE');
      }
      if (index === -1 && this.state.queue.length > 0) index = 0;

      if (index !== -1) {
        const ticket = this.state.queue.splice(index, 1)[0];
        if (this.state.senhaAtualText && this.state.senhaAtualText !== 'N000') {
          this.state.ultimaSenhaText = this.state.senhaAtualText;
        }

        this.state.senhaAtualText = ticket.id;
        this.state.patientNameAtual = ticket.patientName || '';
        this.state.guicheAtual = 'Recepção';
        this.state.tipoAtendimento = ticket.type === 'PRIORIDADE' ? 'Atendimento Prioritário' : 'Atendimento Normal';

        const historyEntry = {
          ticketId: ticket.id,
          patientName: ticket.patientName,
          destination: 'Recepção',
          text: ticket.patientName ? `${ticket.id} (${ticket.patientName}) - Recepção` : `${ticket.id} - Recepção`
        };

        this.state.historico.unshift(historyEntry);
        if (this.state.historico.length > 3) this.state.historico.pop();

        this.state.saveToStorage();
        this.updateUI();
        this.notificarLocal();
      }
    }
  }

  chamarSenhaEspecifica(ticketId) {
    this.sendEvent('CALL_NEXT', { destination: 'Recepção', specificTicketId: ticketId });
  }

  repetirChamada() {
    if (this.state.senhaAtualText && this.state.senhaAtualText !== 'N000') {
      this.sendEvent('REPEAT_CALL', { state: this.state });
      this.notificarLocal();
    }
  }

  voltarNormal() {
    if (this.state.senhaNormalCount > 0) {
      this.state.senhaNormalCount -= 1;
      this.state.senhaAtualText = 'N' + padNumber(this.state.senhaNormalCount, 3);
      this.state.patientNameAtual = '';
      this.state.saveToStorage();
      this.updateUI();
      this.sendEvent('CALL_TICKET', this.state);
    }
  }

  voltarPrioridade() {
    if (this.state.senhaPrioridadedCount > 0) {
      this.state.senhaPrioridadedCount -= 1;
      this.state.senhaAtualText = 'P' + padNumber(this.state.senhaPrioridadedCount, 3);
      this.state.patientNameAtual = '';
      this.state.saveToStorage();
      this.updateUI();
      this.sendEvent('CALL_TICKET', this.state);
    }
  }

  notificarLocal() {
    if (this.dom.displayCard) {
      this.dom.displayCard.classList.remove('calling');
      void this.dom.displayCard.offsetWidth;
      this.dom.displayCard.classList.add('calling');
    }
    if (this.state.somHabilitado) this.tocarGingle();
    if (this.state.vozHabilitada) setTimeout(() => this.anunciarVoz(this.state.senhaAtualText, this.state.guicheAtual, this.state.patientNameAtual), 700);
  }

  tocarGingle() {
    if (this.dom.audioChamada) {
      this.dom.audioChamada.currentTime = 0;
      const p = this.dom.audioChamada.play();
      if (p !== undefined) p.catch(() => {});
    }
  }

  anunciarVoz(senhaStr, guicheStr, patientName = '') {
    if (!this.speechSynth) return;
    this.speechSynth.cancel();

    let textoVoz = '';
    const gText = guicheStr ? `, ${guicheStr}` : '';
    const nameText = patientName ? `, ${patientName}` : '';

    if (senhaStr.startsWith('P')) {
      const num = senhaStr.substring(1);
      textoVoz = `Senha prioritária, P, ${num.split('').join(' ')}${nameText}${gText}`;
    } else if (senhaStr.startsWith('N')) {
      const num = senhaStr.substring(1);
      textoVoz = `Senha normal, N, ${num.split('').join(' ')}${nameText}${gText}`;
    } else {
      textoVoz = `Senha, ${senhaStr.split('').join(' ')}${nameText}${gText}`;
    }

    const utterance = new SpeechSynthesisUtterance(textoVoz);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    this.speechSynth.speak(utterance);
  }

  updateUI() {
    if (this.dom.senhaAtualNumero) this.dom.senhaAtualNumero.textContent = this.state.senhaAtualText;
    if (this.dom.ultimaSenhaNumero) this.dom.ultimaSenhaNumero.textContent = this.state.ultimaSenhaText;
    if (this.dom.currentGuicheBadge) this.dom.currentGuicheBadge.textContent = this.state.guicheAtual;

    if (this.dom.displayPatientName) {
      this.dom.displayPatientName.textContent = this.state.patientNameAtual ? `Paciente: ${this.state.patientNameAtual}` : '';
    }

    if (this.dom.displayTypeBadge) {
      if (this.state.senhaAtualText.startsWith('P')) {
        this.dom.displayTypeBadge.textContent = 'Atendimento Prioritário';
        this.dom.displayTypeBadge.className = 'display-type-badge prioridade';
      } else if (this.state.senhaAtualText !== 'N000' && this.state.senhaAtualText !== '0000') {
        this.dom.displayTypeBadge.textContent = 'Atendimento Normal';
        this.dom.displayTypeBadge.className = 'display-type-badge normal';
      } else {
        this.dom.displayTypeBadge.textContent = 'Aguardando Chamada';
        this.dom.displayTypeBadge.className = 'display-type-badge';
      }
    }

    const rawQueue = this.state.queue || [];
    const sortedQueue = [...rawQueue].sort((a, b) => {
      if (a.type === 'PRIORIDADE' && b.type !== 'PRIORIDADE') return -1;
      if (a.type !== 'PRIORIDADE' && b.type === 'PRIORIDADE') return 1;
      return 0;
    });

    if (this.dom.totalQueueCount) this.dom.totalQueueCount.textContent = sortedQueue.length;

    if (this.dom.queueListContainer) {
      this.dom.queueListContainer.innerHTML = '';
      if (sortedQueue.length === 0) {
        this.dom.queueListContainer.innerHTML = '<p class="queue-empty-text">Nenhum paciente aguardando na fila.</p>';
      } else {
        sortedQueue.forEach((t) => {
          const pill = document.createElement('button');
          pill.className = `queue-item-pill ${t.type === 'PRIORIDADE' ? 'prioridade' : ''}`;
          pill.title = `Clique para chamar ${t.id} agora`;
          const namePart = t.patientName ? ` - ${t.patientName}` : '';
          pill.innerHTML = `<strong>${t.id}</strong> <span>(${t.destination}${namePart})</span>`;
          pill.addEventListener('click', () => this.chamarSenhaEspecifica(t.id));
          this.dom.queueListContainer.appendChild(pill);
        });
      }
    }

    if (this.dom.historicoLista) {
      this.dom.historicoLista.innerHTML = '';
      const historico = (this.state.historico || []).slice(0, 3);
      if (historico.length === 0) {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.style.opacity = '0.6';
        li.textContent = 'Nenhuma chamada realizada';
        this.dom.historicoLista.appendChild(li);
      } else {
        historico.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'history-item';
          
          let formattedText = '';
          if (typeof item === 'object' && item !== null) {
            formattedText = item.text || `${item.ticketId} - ${item.destination}`;
          } else {
            formattedText = String(item);
          }

          li.textContent = formattedText;
          this.dom.historicoLista.appendChild(li);
        });
      }
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape' && this.dom.confirmResetModal?.classList.contains('active')) {
      this.fecharModalReset();
      return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'ArrowRight') {
      e.preventDefault();
      this.chamarProxima('NORMAL');
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      this.chamarProxima('PRIORIDADE');
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      this.repetirChamada();
    } else if (e.code === 'KeyA') {
      e.preventDefault();
      this.voltarNormal();
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      this.voltarPrioridade();
    }
  }

  abrirModalReset() {
    this.dom.confirmResetModal?.classList.add('active');
  }

  fecharModalReset() {
    this.dom.confirmResetModal?.classList.remove('active');
  }

  executarReset() {
    this.fecharModalReset();
    this.state.resetState();
    this.updateUI();
    this.sendEvent('RESET_TICKETS', {});
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('chama_senha_theme', newTheme);
  }

  initTheme() {
    const savedTheme = localStorage.getItem('chama_senha_theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleSound() {
    this.state.somHabilitado = !this.state.somHabilitado;
    this.state.saveToStorage();
    if (this.dom.soundToggleBtn) this.dom.soundToggleBtn.style.opacity = this.state.somHabilitado ? '1' : '0.5';
  }

  toggleSpeech() {
    this.state.vozHabilitada = !this.state.vozHabilitada;
    this.state.saveToStorage();
    if (this.dom.speechToggleBtn) this.dom.speechToggleBtn.style.opacity = this.state.vozHabilitada ? '1' : '0.5';
  }

  updateConnectionStatus(isOnline, text) {
    if (this.dom.statusDot) this.dom.statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    if (this.dom.statusText) this.dom.statusText.textContent = text;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chamaSenhaApp = new ChamaSenhaApp();
});
