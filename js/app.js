/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SCRIPT DO OPERADOR (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script principal do Painel do Operador/Recepção (index.html).
 *            Gerencia contadores, sincronização em tempo real (WebSocket e
 *            BroadcastChannel), seleção de guichês, modal customizado de reset,
 *            repetição de chamadas e preferências de tema.
 * ============================================================================
 */

/**
 * Módulo de Gestão do Estado do Atendimento
 */
class StateManager {
  static STORAGE_KEY = 'chama_senha_state_v1';

  constructor() {
    const savedState = this.loadFromStorage();
    this.senhaNormal = savedState?.senhaNormal ?? 0;
    this.senhaPrioridade = savedState?.senhaPrioridade ?? 0;
    this.senhaAtualText = savedState?.senhaAtualText ?? '0000';
    this.ultimaSenhaText = savedState?.ultimaSenhaText ?? '0000';
    this.guicheAtual = savedState?.guicheAtual ?? 'Guichê 01';
    this.tipoAtendimento = savedState?.tipoAtendimento ?? 'Aguardando Chamada';
    this.historico = savedState?.historico ?? [];
    this.somHabilitado = savedState?.somHabilitado ?? true;
    this.vozHabilitada = savedState?.vozHabilitada ?? true;
  }

  saveToStorage() {
    try {
      const stateToSave = {
        senhaNormal: this.senhaNormal,
        senhaPrioridade: this.senhaPrioridade,
        senhaAtualText: this.senhaAtualText,
        ultimaSenhaText: this.ultimaSenhaText,
        guicheAtual: this.guicheAtual,
        tipoAtendimento: this.tipoAtendimento,
        historico: this.historico.slice(0, 5),
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
    this.senhaNormal = 0;
    this.senhaPrioridade = 0;
    this.senhaAtualText = '0000';
    this.ultimaSenhaText = '0000';
    this.tipoAtendimento = 'Aguardando Chamada';
    this.historico = [];
    this.saveToStorage();
  }
}

/**
 * Função Auxiliar para formatação de zeros à esquerda
 */
function padNumber(num, size) {
  return String(num).padStart(size, '0');
}

/**
 * Aplicação Principal do Operador
 */
class ChamaSenhaApp {
  constructor() {
    this.state = new StateManager();
    this.speechSynth = window.speechSynthesis || null;
    this.socket = null;
    this.broadcastChannel = null;

    // Seleção dos elementos do DOM
    this.dom = {
      senhaAtualNumero: document.getElementById('senhaAtualNumero'),
      ultimaSenhaNumero: document.getElementById('ultimaSenhaNumero'),
      displayCard: document.getElementById('displayCard'),
      displayTypeBadge: document.getElementById('displayTypeBadge'),
      currentGuicheBadge: document.getElementById('currentGuicheBadge'),
      guicheSelect: document.getElementById('guicheSelect'),
      historicoLista: document.getElementById('historicoLista'),
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

      // Modal Customizado
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
    console.log('[ChamaSenha Operador]: Painel do Operador inicializado.');
  }

  /**
   * Conecta os escutadores de eventos de botões e atalhos de teclado.
   */
  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Ações do Operador
    this.dom.btnProximaNormal?.addEventListener('click', () => this.chamarProximaNormal());
    this.dom.btnAnteriorNormal?.addEventListener('click', () => this.voltarNormal());
    this.dom.btnProximaPrior?.addEventListener('click', () => this.chamarProximaPrioridade());
    this.dom.btnAnteriorPrior?.addEventListener('click', () => this.voltarPrioridade());
    this.dom.btnRepetir?.addEventListener('click', () => this.repetirChamada());
    
    // Mudança de Guichê
    this.dom.guicheSelect?.addEventListener('change', (e) => {
      this.state.guicheAtual = e.target.value;
      this.state.saveToStorage();
      this.updateUI();
    });

    // Modal Customizado de Zerar Senhas
    this.dom.btnReset?.addEventListener('click', () => this.abrirModalReset());
    this.dom.btnCancelReset?.addEventListener('click', () => this.fecharModalReset());
    this.dom.btnConfirmReset?.addEventListener('click', () => this.executarReset());

    // Preferências Globais
    this.dom.themeToggleBtn?.addEventListener('click', () => this.toggleTheme());
    this.dom.soundToggleBtn?.addEventListener('click', () => this.toggleSound());
    this.dom.speechToggleBtn?.addEventListener('click', () => this.toggleSpeech());
  }

  /**
   * Inicializa comunicação real-time (WebSocket principal + BroadcastChannel fallback)
   */
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
            if (data.type === 'INIT_STATE') {
              this.state.senhaNormal = data.payload.senhaNormal ?? this.state.senhaNormal;
              this.state.senhaPrioridade = data.payload.senhaPrioridade ?? this.state.senhaPrioridade;
              this.state.senhaAtualText = data.payload.senhaAtualText ?? this.state.senhaAtualText;
              this.state.ultimaSenhaText = data.payload.ultimaSenhaText ?? this.state.ultimaSenhaText;
              this.state.historico = data.payload.historico ?? this.state.historico;
              this.updateUI();
            }
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
      this.updateConnectionStatus(true, 'Modo Local (BroadcastChannel)');
    }
  }

  /**
   * Envia atualização para todas as telas (TVs e Operadores)
   */
  broadcastEvent(eventType, payloadData) {
    // 1. Envia por WebSocket se disponível
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: eventType, payload: payloadData }));
    }

    // 2. Envia por BroadcastChannel fallback
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: eventType, payload: payloadData });
    }
  }

  /**
   * Atalhos de Teclado
   */
  handleKeyDown(e) {
    // Fecha modal se ESC for pressionado
    if (e.key === 'Escape' && this.dom.confirmResetModal?.classList.contains('active')) {
      this.fecharModalReset();
      return;
    }

    // Ignora se estiver num input
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    switch (e.code) {
      case 'ArrowRight':
        e.preventDefault();
        this.chamarProximaNormal();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.chamarProximaPrioridade();
        break;

      case 'KeyR':
        e.preventDefault();
        this.repetirChamada();
        break;

      case 'KeyA':
        e.preventDefault();
        this.voltarNormal();
        break;

      case 'KeyS':
        e.preventDefault();
        this.voltarPrioridade();
        break;

      default:
        break;
    }
  }

  chamarProximaNormal() {
    this.registrarUltimaSenha();
    this.state.senhaNormal += 1;
    const novaSenhaStr = padNumber(this.state.senhaNormal, 4);
    
    this.state.senhaAtualText = novaSenhaStr;
    this.state.tipoAtendimento = 'Atendimento Normal';
    this.notificarChamada('CALL_TICKET');
  }

  chamarProximaPrioridade() {
    this.registrarUltimaSenha();
    this.state.senhaPrioridade += 1;
    const novaSenhaStr = 'P' + padNumber(this.state.senhaPrioridade, 3);
    
    this.state.senhaAtualText = novaSenhaStr;
    this.state.tipoAtendimento = 'Atendimento Prioritário';
    this.notificarChamada('CALL_TICKET');
  }

  repetirChamada() {
    if (this.state.senhaAtualText && this.state.senhaAtualText !== '0000') {
      this.notificarChamada('REPEAT_CALL');
    }
  }

  voltarNormal() {
    if (this.state.senhaNormal > 0) {
      this.state.senhaNormal -= 1;
      const novaSenhaStr = padNumber(this.state.senhaNormal, 4);
      this.state.senhaAtualText = novaSenhaStr;
      this.state.saveToStorage();
      this.updateUI();
      this.broadcastEvent('CALL_TICKET', this.getCurrentPayload());
    }
  }

  voltarPrioridade() {
    if (this.state.senhaPrioridade > 0) {
      this.state.senhaPrioridade -= 1;
      const novaSenhaStr = 'P' + padNumber(this.state.senhaPrioridade, 3);
      this.state.senhaAtualText = novaSenhaStr;
      this.state.saveToStorage();
      this.updateUI();
      this.broadcastEvent('CALL_TICKET', this.getCurrentPayload());
    }
  }

  registrarUltimaSenha() {
    if (this.state.senhaAtualText && this.state.senhaAtualText !== '0000') {
      this.state.ultimaSenhaText = this.state.senhaAtualText;
      if (this.state.historico[0] !== this.state.senhaAtualText) {
        this.state.historico.unshift(this.state.senhaAtualText);
        if (this.state.historico.length > 5) this.state.historico.pop();
      }
    }
  }

  getCurrentPayload() {
    return {
      senhaNormal: this.state.senhaNormal,
      senhaPrioridade: this.state.senhaPrioridade,
      senhaAtualText: this.state.senhaAtualText,
      ultimaSenhaText: this.state.ultimaSenhaText,
      guicheAtual: this.state.guicheAtual,
      tipoAtendimento: this.state.tipoAtendimento,
      historico: this.state.historico
    };
  }

  notificarChamada(eventType) {
    this.updateUI();
    this.state.saveToStorage();

    const payload = this.getCurrentPayload();
    this.broadcastEvent(eventType, payload);

    // Efeito local no operador
    if (this.dom.displayCard) {
      this.dom.displayCard.classList.remove('calling');
      void this.dom.displayCard.offsetWidth;
      this.dom.displayCard.classList.add('calling');
    }

    if (this.state.somHabilitado) this.tocarGingle();
    if (this.state.vozHabilitada) setTimeout(() => this.anunciarVoz(this.state.senhaAtualText, this.state.guicheAtual), 700);
  }

  tocarGingle() {
    if (this.dom.audioChamada) {
      this.dom.audioChamada.currentTime = 0;
      const p = this.dom.audioChamada.play();
      if (p !== undefined) p.catch(() => {});
    }
  }

  anunciarVoz(senhaStr, guicheStr) {
    if (!this.speechSynth) return;
    this.speechSynth.cancel();

    let textoVoz = '';
    const gText = guicheStr ? `, ${guicheStr}` : '';
    if (senhaStr.startsWith('P')) {
      const num = senhaStr.substring(1);
      textoVoz = `Senha prioritária, P, ${num.split('').join(' ')}${gText}`;
    } else {
      textoVoz = `Senha, ${senhaStr.split('').join(' ')}${gText}`;
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
    if (this.dom.guicheSelect) this.dom.guicheSelect.value = this.state.guicheAtual;

    if (this.dom.displayTypeBadge) {
      if (this.state.senhaAtualText.startsWith('P')) {
        this.dom.displayTypeBadge.textContent = 'Atendimento Prioritário';
        this.dom.displayTypeBadge.className = 'display-type-badge prioridade';
      } else if (this.state.senhaAtualText !== '0000') {
        this.dom.displayTypeBadge.textContent = 'Atendimento Normal';
        this.dom.displayTypeBadge.className = 'display-type-badge normal';
      } else {
        this.dom.displayTypeBadge.textContent = 'Aguardando Chamada';
        this.dom.displayTypeBadge.className = 'display-type-badge';
      }
    }

    if (this.dom.historicoLista) {
      this.dom.historicoLista.innerHTML = '';
      if (this.state.historico.length === 0) {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.style.opacity = '0.6';
        li.textContent = 'Nenhuma chamada realizada';
        this.dom.historicoLista.appendChild(li);
      } else {
        this.state.historico.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'history-item';
          li.textContent = item;
          this.dom.historicoLista.appendChild(li);
        });
      }
    }
  }

  // Modal Customizado
  abrirModalReset() {
    if (this.dom.confirmResetModal) {
      this.dom.confirmResetModal.classList.add('active');
    }
  }

  fecharModalReset() {
    if (this.dom.confirmResetModal) {
      this.dom.confirmResetModal.classList.remove('active');
    }
  }

  executarReset() {
    this.fecharModalReset();
    this.state.resetState();
    this.updateUI();
    this.broadcastEvent('RESET_TICKETS', this.getCurrentPayload());
    console.log('[ChamaSenha]: Contadores zerados pelo operador.');
  }

  // Alternância do Tema Escuro / Claro
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
