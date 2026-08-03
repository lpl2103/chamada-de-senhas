/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SCRIPT DA TELA DO PACIENTE (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script especializado para o celular do paciente (paciente.html).
 *            Lê a senha do parâmetro URL ?ticket=N001 e monitora a posição na fila.
 * ============================================================================
 */

class ChamaSenhaPaciente {
  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    this.targetTicketId = (urlParams.get('ticket') || 'N000').toUpperCase();

    this.socket = null;
    this.broadcastChannel = null;

    this.dom = {
      ticketNumber: document.getElementById('patientTicketNumber'),
      patientNameText: document.getElementById('patientNameText'),
      statusBadge: document.getElementById('patientStatusBadge'),
      aheadCount: document.getElementById('patientAheadCount'),
      destination: document.getElementById('patientDestination'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText')
    };

    this.init();
  }

  init() {
    if (this.dom.ticketNumber) {
      this.dom.ticketNumber.textContent = this.targetTicketId;
    }
    this.initCommunication();
    console.log(`[ChamaSenha Paciente]: Monitorando senha ${this.targetTicketId}.`);
  }

  initCommunication() {
    if (window.location.protocol.startsWith('http')) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.updateConnectionStatus(true, 'Conectado ao Sistema');
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
          } catch (e) {}
        };

        this.socket.onclose = () => {
          this.updateConnectionStatus(false, 'Modo Local');
          this.setupFallbackChannel();
        };

        this.socket.onerror = () => {
          this.updateConnectionStatus(false, 'Modo Local');
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
      this.updateConnectionStatus(true, 'Modo Local');
    }
  }

  handleIncomingMessage(data) {
    if (!data) return;

    const payload = data.payload?.state || data.payload;
    if (payload) {
      this.renderState(payload);
    }
  }

  renderState(state) {
    if (!state) return;

    // Se a senha atual sendo chamada na TV é a senha deste paciente
    if (state.senhaAtualText === this.targetTicketId) {
      if (this.dom.statusBadge) {
        this.dom.statusBadge.textContent = '🚨 É A SUA VEZ! DIRIJA-SE À SALA';
        this.dom.statusBadge.className = 'patient-status-badge called';
      }
      if (this.dom.aheadCount) this.dom.aheadCount.textContent = '0';
      if (this.dom.destination) this.dom.destination.textContent = state.guicheAtual || 'Consultório';
      if (this.dom.patientNameText && state.patientNameAtual) {
        this.dom.patientNameText.textContent = `Paciente: ${state.patientNameAtual}`;
      }
      return;
    }

    const queue = state.queue || [];
    const indexInQueue = queue.findIndex(t => t.id === this.targetTicketId);

    if (indexInQueue !== -1) {
      const ticketObj = queue[indexInQueue];
      if (this.dom.patientNameText && ticketObj.patientName) {
        this.dom.patientNameText.textContent = `Paciente: ${ticketObj.patientName}`;
      }
      if (this.dom.destination) {
        this.dom.destination.textContent = ticketObj.destination || 'Consultório';
      }

      if (indexInQueue === 0) {
        if (this.dom.statusBadge) {
          this.dom.statusBadge.textContent = '⏳ VOCÊ É O PRÓXIMO DA FILA!';
          this.dom.statusBadge.className = 'patient-status-badge next';
        }
        if (this.dom.aheadCount) this.dom.aheadCount.textContent = '0';
      } else {
        if (this.dom.statusBadge) {
          this.dom.statusBadge.textContent = '⏳ Aguardando na Fila';
          this.dom.statusBadge.className = 'patient-status-badge waiting';
        }
        if (this.dom.aheadCount) this.dom.aheadCount.textContent = indexInQueue;
      }
    } else {
      // Verifica se a senha já está concluída no histórico
      const inHistory = (state.historico || []).some(item => {
        const id = typeof item === 'object' ? item.ticketId : String(item);
        return id.includes(this.targetTicketId);
      });

      if (inHistory) {
        if (this.dom.statusBadge) {
          this.dom.statusBadge.textContent = '✅ Atendimento Concluído';
          this.dom.statusBadge.className = 'patient-status-badge completed';
        }
        if (this.dom.aheadCount) this.dom.aheadCount.textContent = '0';
      } else {
        if (this.dom.statusBadge) {
          this.dom.statusBadge.textContent = 'Aguardando início...';
          this.dom.statusBadge.className = 'patient-status-badge';
        }
      }
    }
  }

  updateConnectionStatus(isOnline, text) {
    if (this.dom.statusDot) this.dom.statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    if (this.dom.statusText) this.dom.statusText.textContent = text;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chamaSenhaPaciente = new ChamaSenhaPaciente();
});
