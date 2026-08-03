/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - PAINEL DA TV (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script especializado para o Painel da TV/Monitor (tv.html).
 *            Ajustado para caber 100% na viewport (sem rolagem), aciona
 *            modo fullscreen no primeiro clique/tecla e sincroniza chamadas.
 * ============================================================================
 */

class ChamaSenhaTV {
  constructor() {
    this.speechSynth = window.speechSynthesis || null;
    this.somHabilitado = true;
    this.vozHabilitada = true;
    this.socket = null;
    this.broadcastChannel = null;

    // Elementos do DOM da TV
    this.dom = {
      senhaAtualNumero: document.getElementById('tvSenhaAtualNumero'),
      guicheBadge: document.getElementById('tvGuicheBadge'),
      displayTypeBadge: document.getElementById('tvDisplayTypeBadge'),
      displayCard: document.getElementById('tvDisplayCard'),
      historicoLista: document.getElementById('tvHistoricoLista'),
      digitalClock: document.getElementById('digitalClock'),
      digitalDate: document.getElementById('digitalDate'),
      audioChamada: document.getElementById('audioChamada'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText')
    };

    this.init();
  }

  /**
   * Inicialização da aplicação na TV.
   */
  init() {
    this.initClock();
    this.initTheme();
    this.bindEvents();
    this.initCommunication();
    console.log('[ChamaSenha TV]: Painel de Exibição da TV inicializado (Modo Viewport Fit).');
  }

  /**
   * Conecta os escutadores de tela cheia automática e navegação.
   */
  bindEvents() {
    // Ao clicar em qualquer ponto da tela ou pressionar qualquer tecla, ativa Tela Cheia (Fullscreen)
    const requestFullscreenHandler = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('click', requestFullscreenHandler, { once: false });
    document.addEventListener('keydown', requestFullscreenHandler, { once: false });
  }

  /**
   * Configura o sistema de comunicação (WebSocket principal + BroadcastChannel fallback).
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
            this.handleIncomingMessage(data);
          } catch (err) {
            console.error('[TV WS Error]: Mensagem malformada:', err);
          }
        };

        this.socket.onclose = () => {
          this.updateConnectionStatus(false, 'Servidor Desconectado (Modo Local)');
          this.setupFallbackChannel();
        };

        this.socket.onerror = () => {
          this.updateConnectionStatus(false, 'Erro de Conexão (Modo Local)');
          this.setupFallbackChannel();
        };
      } catch (err) {
        this.setupFallbackChannel();
      }
    } else {
      this.setupFallbackChannel();
    }

    // Escuta eventos de localStorage para atualização de abas do mesmo navegador
    window.addEventListener('storage', (e) => {
      if (e.key === 'chama_senha_state_v1' && e.newValue) {
        try {
          const state = JSON.parse(e.newValue);
          this.renderState(state, true);
        } catch (err) {}
      }
    });
  }

  /**
   * Configura o fallback BroadcastChannel para comunicação local no navegador.
   */
  setupFallbackChannel() {
    if ('BroadcastChannel' in window && !this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel('chama_senha_channel');
      this.broadcastChannel.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };
      this.updateConnectionStatus(true, 'Conectado via Rede Local (BroadcastChannel)');
    }
  }

  /**
   * Processa as mensagens recebidas via WebSocket ou BroadcastChannel.
   * @param {Object} data - Dados da mensagem.
   */
  handleIncomingMessage(data) {
    if (!data || !data.payload) return;

    switch (data.type) {
      case 'INIT_STATE':
        this.renderState(data.payload, false);
        break;

      case 'TICKET_CALLED':
      case 'TICKET_REPEATED':
        this.renderState(data.payload, true);
        break;

      case 'TICKETS_RESET':
        this.renderState(data.payload, false);
        break;

      default:
        break;
    }
  }

  /**
   * Renderiza o estado na tela da TV e dispara alertas sonoros/voz se solicitado.
   * @param {Object} state - Estado atual dos contadores.
   * @param {boolean} triggerAlerts - Se deve acionar áudio e voz.
   */
  renderState(state, triggerAlerts = false) {
    if (this.dom.senhaAtualNumero) {
      this.dom.senhaAtualNumero.textContent = state.senhaAtualText || '0000';
    }

    if (this.dom.guicheBadge) {
      this.dom.guicheBadge.textContent = state.guicheAtual || 'GUICHÊ 01';
    }

    if (this.dom.displayTypeBadge) {
      const isPrior = state.senhaAtualText?.startsWith('P');
      this.dom.displayTypeBadge.textContent = state.tipoAtendimento || (isPrior ? 'Atendimento Prioritário' : 'Atendimento Normal');
      this.dom.displayTypeBadge.className = `display-type-badge tv-type-badge ${isPrior ? 'prioridade' : 'normal'}`;
    }

    // Atualiza Histórico
    if (this.dom.historicoLista) {
      this.dom.historicoLista.innerHTML = '';
      const historico = state.historico || [];
      if (historico.length === 0) {
        const itemVazio = document.createElement('li');
        itemVazio.className = 'history-item';
        itemVazio.style.opacity = '0.6';
        itemVazio.textContent = 'Aguardando início do atendimento...';
        this.dom.historicoLista.appendChild(itemVazio);
      } else {
        historico.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'history-item';
          li.textContent = item;
          this.dom.historicoLista.appendChild(li);
        });
      }
    }

    // Se for uma nova chamada ou repetição, dispara alertas e animação
    if (triggerAlerts && state.senhaAtualText !== '0000') {
      this.animateCard();
      if (this.somHabilitado) this.tocarGingle();
      if (this.vozHabilitada) setTimeout(() => this.anunciarVoz(state.senhaAtualText, state.guicheAtual), 700);
    }
  }

  /**
   * Efeito de pulso visual no card quando uma senha é chamada.
   */
  animateCard() {
    if (this.dom.displayCard) {
      this.dom.displayCard.classList.remove('calling');
      void this.dom.displayCard.offsetWidth; // Reflow
      this.dom.displayCard.classList.add('calling');
    }
  }

  /**
   * Toca o sinal sonoro da chamada.
   */
  tocarGingle() {
    if (this.dom.audioChamada) {
      this.dom.audioChamada.currentTime = 0;
      const promise = this.dom.audioChamada.play();
      if (promise !== undefined) {
        promise.catch((err) => console.warn('[TV Audio]: Bloqueio de áudio:', err));
      }
    }
  }

  /**
   * Anuncia a senha e o guichê por sintetizador de voz.
   */
  anunciarVoz(senhaStr, guicheStr) {
    if (!this.speechSynth) return;

    this.speechSynth.cancel();

    let textoVoz = '';
    const guicheFormatado = guicheStr ? `, ${guicheStr}` : '';

    if (senhaStr.startsWith('P')) {
      const num = senhaStr.substring(1);
      textoVoz = `Senha prioritária, P, ${num.split('').join(' ')}${guicheFormatado}`;
    } else {
      textoVoz = `Senha, ${senhaStr.split('').join(' ')}${guicheFormatado}`;
    }

    const utterance = new SpeechSynthesisUtterance(textoVoz);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    this.speechSynth.speak(utterance);
  }

  /**
   * Atualiza o indicador visual do status de conexão.
   */
  updateConnectionStatus(isOnline, text) {
    if (this.dom.statusDot) {
      this.dom.statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
    if (this.dom.statusText) {
      this.dom.statusText.textContent = text;
    }
  }

  /**
   * Inicializa o relógio digital e data no cabeçalho.
   */
  initClock() {
    const updateTime = () => {
      const now = new Date();
      if (this.dom.digitalClock) {
        this.dom.digitalClock.textContent = now.toLocaleTimeString('pt-BR');
      }
      if (this.dom.digitalDate) {
        this.dom.digitalDate.textContent = now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  /**
   * Carrega o tema salvo.
   */
  initTheme() {
    const savedTheme = localStorage.getItem('chama_senha_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }
}

// Inicializa a TV assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.chamaSenhaTV = new ChamaSenhaTV();
});
