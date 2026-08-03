/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SCRIPT DO CONSULTÓRIO (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script especializado para o Painel do Médico/Consultório (atendimento.html).
 *            Sem emissão de áudio local (áudio executado exclusivamente na TV).
 *            Listagem em tempo real de senhas cadastradas para o consultório.
 * ============================================================================
 */

class ChamaSenhaDoctorApp {
  constructor() {
    this.socket = null;
    this.broadcastChannel = null;
    this.selectedRoom = localStorage.getItem('chama_senha_doctor_room') || 'Consultório A';

    // Elementos do DOM
    this.dom = {
      doctorRoomSelect: document.getElementById('doctorRoomSelect'),
      doctorRoomPill: document.getElementById('doctorRoomPill'),
      waitingQueueCount: document.getElementById('waitingQueueCount'),
      doctorQueueCount: document.getElementById('doctorQueueCount'),
      doctorQueueContainer: document.getElementById('doctorQueueContainer'),
      senhaAtualNumero: document.getElementById('doctorSenhaAtualNumero'),
      displayTypeBadge: document.getElementById('doctorDisplayTypeBadge'),
      displayCard: document.getElementById('doctorDisplayCard'),
      btnCallNext: document.getElementById('btnDoctorCallNext'),
      btnRepeat: document.getElementById('btnDoctorRepeat'),
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
    console.log(`[ChamaSenha Consultório]: Inicializado na sala ${this.selectedRoom} (Sem som local).`);
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
      if (this.dom.displayTypeBadge) {
        this.dom.displayTypeBadge.textContent = state.tipoAtendimento || 'Em Atendimento';
      }
    }

    // Filtra senhas cadastradas para este consultório ou fila geral
    const queue = state.queue || [];
    const roomTickets = queue.filter(
      (t) => t.destination === this.selectedRoom || t.destination === 'Geral'
    );

    if (this.dom.waitingQueueCount) {
      this.dom.waitingQueueCount.textContent = roomTickets.length;
    }
    if (this.dom.doctorQueueCount) {
      this.dom.doctorQueueCount.textContent = roomTickets.length;
    }

    // Renderiza a lista de senhas cadastradas para o consultório
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
          pill.innerHTML = `<strong>${t.id}</strong> <span>(${t.type === 'PRIORIDADE' ? 'Prioritária' : 'Normal'})</span>`;
          pill.addEventListener('click', () => this.chamarSenhaEspecifica(t.id));
          this.dom.doctorQueueContainer.appendChild(pill);
        });
      }
    }
  }

  chamarProximoPaciente() {
    const payloadData = { destination: this.selectedRoom };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'CALL_NEXT', payload: payloadData }));
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'CALL_NEXT', payload: payloadData });
    }

    this.animateCard();
  }

  chamarSenhaEspecifica(ticketId) {
    const payloadData = { destination: this.selectedRoom, specificTicketId: ticketId };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'CALL_NEXT', payload: payloadData }));
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'CALL_NEXT', payload: payloadData });
    }

    this.animateCard();
  }

  repetirChamada() {
    const payloadData = { destination: this.selectedRoom };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'REPEAT_CALL', payload: payloadData }));
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'REPEAT_CALL', payload: payloadData });
    }

    this.animateCard();
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
