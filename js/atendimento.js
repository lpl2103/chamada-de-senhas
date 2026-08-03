/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SCRIPT DO CONSULTÓRIO (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script especializado para o Painel do Médico/Consultório (atendimento.html).
 *            Suporte aos botões de Iniciar, Finalizar Atendimento e Marcar Ausente.
 * ============================================================================
 */

class ChamaSenhaDoctorApp {
  constructor() {
    this.socket = null;
    this.broadcastChannel = null;
    this.currentTicket = null;

    let savedRoom = localStorage.getItem('chama_senha_doctor_room');
    if (!savedRoom || savedRoom.includes('Consultório A') || savedRoom.includes('Consultório B') || savedRoom.includes('Consultório C')) {
      savedRoom = 'Consultório 01';
      localStorage.setItem('chama_senha_doctor_room', savedRoom);
    }
    this.selectedRoom = savedRoom;

    // Elementos do DOM
    this.dom = {
      doctorRoomSelect: document.getElementById('doctorRoomSelect'),
      doctorRoomPill: document.getElementById('doctorRoomPill'),
      waitingQueueCount: document.getElementById('waitingQueueCount'),
      doctorQueueCount: document.getElementById('doctorQueueCount'),
      doctorQueueContainer: document.getElementById('doctorQueueContainer'),
      senhaAtualNumero: document.getElementById('doctorSenhaAtualNumero'),
      doctorPatientName: document.getElementById('doctorPatientName'),
      displayTypeBadge: document.getElementById('doctorDisplayTypeBadge'),
      displayCard: document.getElementById('doctorDisplayCard'),
      btnCallNext: document.getElementById('btnDoctorCallNext'),
      btnRepeat: document.getElementById('btnDoctorRepeat'),
      btnStart: document.getElementById('btnDoctorStart'),
      btnComplete: document.getElementById('btnDoctorComplete'),
      btnAbsent: document.getElementById('btnDoctorAbsent'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      themeToggleBtn: document.getElementById('themeToggleBtn')
    };

    this.init();
  }

  init() {
    this.initTheme();
    this.bindEvents();
    this.initCommunication();
    if (this.dom.doctorRoomSelect) {
      this.dom.doctorRoomSelect.value = this.selectedRoom;
    }
    this.updateRoomLabel();
    console.log(`[ChamaSenha Consultório]: Inicializado no ${this.selectedRoom}.`);
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    this.dom.doctorRoomSelect?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      localStorage.setItem('chama_senha_doctor_room', this.selectedRoom);
      this.updateRoomLabel();
      this.requestStateRefresh();
    });

    this.dom.btnCallNext?.addEventListener('click', () => this.chamarProximoPaciente());
    this.dom.btnRepeat?.addEventListener('click', () => this.repetirChamada());
    this.dom.btnStart?.addEventListener('click', () => this.iniciarAtendimento());
    this.dom.btnComplete?.addEventListener('click', () => this.finalizarAtendimento());
    this.dom.btnAbsent?.addEventListener('click', () => this.marcarAusente());
    this.dom.themeToggleBtn?.addEventListener('click', () => this.toggleTheme());
  }

  updateRoomLabel() {
    if (this.dom.doctorRoomPill) {
      this.dom.doctorRoomPill.textContent = this.selectedRoom;
    }
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
        if (event.data) this.handleIncomingMessage(event.data);
      };
      this.updateConnectionStatus(true, 'Modo Local (BroadcastChannel)');
    }
  }

  handleIncomingMessage(data) {
    if (!data) return;

    const payload = data.payload?.state || data.payload;
    if (payload) {
      this.renderState(payload);
    }
  }

  requestStateRefresh() {
    const saved = localStorage.getItem('chama_senha_state_v1');
    if (saved) {
      try {
        this.renderState(JSON.parse(saved));
      } catch (e) {}
    }
  }

  renderState(state) {
    if (!state) return;

    // Atualiza número da última senha se a chamada for para esta sala
    if (state.guicheAtual === this.selectedRoom && state.senhaAtualText) {
      if (this.dom.senhaAtualNumero) this.dom.senhaAtualNumero.textContent = state.senhaAtualText;
      if (this.dom.doctorPatientName) {
        this.dom.doctorPatientName.textContent = state.patientNameAtual ? `Paciente: ${state.patientNameAtual}` : '';
      }
      if (this.dom.displayTypeBadge) {
        this.dom.displayTypeBadge.textContent = state.tipoAtendimento || 'Em Atendimento';
      }
    }

    const queue = state.queue || [];
    const roomTickets = queue.filter(
      (t) => t.destination === this.selectedRoom || t.destination === 'Geral'
    );

    roomTickets.sort((a, b) => {
      if (a.type === 'PRIORIDADE' && b.type !== 'PRIORIDADE') return -1;
      if (a.type !== 'PRIORIDADE' && b.type === 'PRIORIDADE') return 1;
      return 0;
    });

    if (this.dom.waitingQueueCount) {
      this.dom.waitingQueueCount.textContent = roomTickets.length;
    }
    if (this.dom.doctorQueueCount) {
      this.dom.doctorQueueCount.textContent = roomTickets.length;
    }

    if (this.dom.doctorQueueContainer) {
      this.dom.doctorQueueContainer.innerHTML = '';

      if (roomTickets.length === 0) {
        this.dom.doctorQueueContainer.innerHTML =
          '<p class="queue-empty-text">Nenhuma senha cadastrada aguardando para este consultório.</p>';
      } else {
        roomTickets.forEach((t) => {
          const pill = document.createElement('button');
          pill.className = `queue-item-pill ${t.type === 'PRIORIDADE' ? 'prioridade' : ''}`;
          pill.title = `Clique para chamar ${t.id} agora`;
          const nameStr = t.patientName ? ` - ${t.patientName}` : '';
          pill.innerHTML = `<strong>${t.id}</strong> <span>(${t.type === 'PRIORIDADE' ? 'Prioritária' : 'Normal'}${nameStr})</span>`;
          pill.addEventListener('click', () => this.chamarSenhaEspecifica(t.id));
          this.dom.doctorQueueContainer.appendChild(pill);
        });
      }
    }
  }

  chamarProximoPaciente() {
    const payloadData = { destination: this.selectedRoom };
    this.sendEvent('CALL_NEXT', payloadData);
    this.animateCard();
  }

  chamarSenhaEspecifica(ticketId) {
    const payloadData = { destination: this.selectedRoom, specificTicketId: ticketId };
    this.sendEvent('CALL_NEXT', payloadData);
    this.animateCard();
  }

  repetirChamada() {
    const payloadData = { destination: this.selectedRoom };
    this.sendEvent('REPEAT_CALL', payloadData);
    this.animateCard();
  }

  iniciarAtendimento() {
    const ticketId = this.dom.senhaAtualNumero?.textContent;
    if (ticketId && ticketId !== 'N000') {
      this.sendEvent('START_SERVICE', { ticketId });
      if (this.dom.displayTypeBadge) this.dom.displayTypeBadge.textContent = 'Em Atendimento...';
    }
  }

  finalizarAtendimento() {
    const ticketId = this.dom.senhaAtualNumero?.textContent;
    if (ticketId && ticketId !== 'N000') {
      this.sendEvent('COMPLETE_SERVICE', { ticketId });
      if (this.dom.displayTypeBadge) this.dom.displayTypeBadge.textContent = 'Atendimento Concluído';
    }
  }

  marcarAusente() {
    const ticketId = this.dom.senhaAtualNumero?.textContent;
    if (ticketId && ticketId !== 'N000') {
      this.sendEvent('MARK_ABSENT', { ticketId });
      if (this.dom.displayTypeBadge) this.dom.displayTypeBadge.textContent = 'Paciente Ausente';
    }
  }

  sendEvent(type, payloadData) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload: payloadData }));
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type, payload: payloadData });
    }
  }

  animateCard() {
    if (this.dom.displayCard) {
      this.dom.displayCard.classList.remove('calling');
      void this.dom.displayCard.offsetWidth;
      this.dom.displayCard.classList.add('calling');
    }
  }

  handleKeyDown(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
      this.chamarProximoPaciente();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      this.repetirChamada();
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('chama_senha_theme', newTheme);
  }

  initTheme() {
    const savedTheme = localStorage.getItem('chama_senha_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }

  updateConnectionStatus(isOnline, text) {
    if (this.dom.statusDot) this.dom.statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    if (this.dom.statusText) this.dom.statusText.textContent = text;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chamaSenhaDoctorApp = new ChamaSenhaDoctorApp();
});
