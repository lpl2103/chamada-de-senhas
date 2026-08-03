/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - PAINEL DA TV (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script especializado para o Painel da TV/Monitor (tv.html).
 *            Anuncia o nome do paciente por voz quando informado.
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
      tvPatientName: document.getElementById('tvPatientName'),
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

  init() {
    this.initClock();
    this.initTheme();
    this.bindEvents();
    this.initCommunication();
    console.log('[ChamaSenha TV Enterprise]: Inicializado.');
  }

  bindEvents() {
    const requestFullscreenHandler = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('click', requestFullscreenHandler, { once: false });
    document.addEventListener('keydown', requestFullscreenHandler, { once: false });
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

    window.addEventListener('storage', (e) => {
      if (e.key === 'chama_senha_state_v1' && e.newValue) {
        try {
          const state = JSON.parse(e.newValue);
          this.renderState(state, true);
        } catch (err) {}
      }
    });
  }

  setupFallbackChannel() {
    if ('BroadcastChannel' in window && !this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel('chama_senha_channel');
      this.broadcastChannel.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };
      this.updateConnectionStatus(true, 'Conectado via Rede Local (BroadcastChannel)');
    }
  }

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

  renderState(state, triggerAlerts = false) {
    if (this.dom.senhaAtualNumero) {
      let text = state.senhaAtualText || 'N000';
      if (text === '0000') text = 'N000';
      this.dom.senhaAtualNumero.textContent = text;
    }

    if (this.dom.tvPatientName) {
      this.dom.tvPatientName.textContent = state.patientNameAtual ? state.patientNameAtual : '';
    }

    if (this.dom.guicheBadge) {
      this.dom.guicheBadge.textContent = state.guicheAtual || 'GUICHÊ 01';
    }

    if (this.dom.displayTypeBadge) {
      const isPrior = state.senhaAtualText?.startsWith('P');
      this.dom.displayTypeBadge.textContent = state.tipoAtendimento || (isPrior ? 'Atendimento Prioritário' : 'Atendimento Normal');
      this.dom.displayTypeBadge.className = `display-type-badge tv-type-badge ${isPrior ? 'prioridade' : 'normal'}`;
    }

    // Renderiza a Lista Vertical do Histórico LIMITADA A APENAS 3 ITENS
    if (this.dom.historicoLista) {
      this.dom.historicoLista.innerHTML = '';
      const rawHistorico = state.historico || [];
      const historico = rawHistorico.slice(0, 3);

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

          let ticketId = '';
          let destination = '';
          let patientName = '';

          if (typeof item === 'object' && item !== null) {
            ticketId = item.ticketId || item.id || '';
            destination = item.destination || item.guiche || '';
            patientName = item.patientName || '';
          } else {
            const textStr = String(item);
            if (textStr.includes('-')) {
              const parts = textStr.split('-');
              ticketId = parts[0].trim();
              destination = parts.slice(1).join('-').trim();
            } else {
              ticketId = textStr;
            }
          }

          const nameText = patientName ? ` (${patientName})` : '';

          if (destination) {
            li.innerHTML = `<strong>${ticketId}</strong>${nameText} <span style="opacity: 0.85; font-weight: 600;">- ${destination}</span>`;
          } else {
            li.textContent = ticketId;
          }

          this.dom.historicoLista.appendChild(li);
        });
      }
    }

    if (triggerAlerts && state.senhaAtualText && state.senhaAtualText !== 'N000' && state.senhaAtualText !== '0000') {
      this.animateCard();
      this.tocarGingle(() => {
        if (this.vozHabilitada) {
          this.anunciarVoz3Vezes(state.senhaAtualText, state.guicheAtual, state.patientNameAtual, 3);
        }
      });
    }
  }

  animateCard() {
    if (this.dom.displayCard) {
      this.dom.displayCard.classList.remove('calling');
      void this.dom.displayCard.offsetWidth;
      this.dom.displayCard.classList.add('calling');
    }
  }

  tocarGingle(onCompleteCallback) {
    if (!this.dom.audioChamada || !this.somHabilitado) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    this.dom.audioChamada.currentTime = 0;
    const playPromise = this.dom.audioChamada.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.dom.audioChamada.onended = () => {
            this.dom.audioChamada.onended = null;
            if (onCompleteCallback) setTimeout(onCompleteCallback, 300);
          };
        })
        .catch((err) => {
          console.warn('[TV Audio]: Bloqueio de autoplay:', err);
          if (onCompleteCallback) onCompleteCallback();
        });
    } else {
      if (onCompleteCallback) setTimeout(onCompleteCallback, 1000);
    }
  }

  anunciarVoz3Vezes(senhaStr, guicheStr, patientName = '', repeticoes = 3) {
    if (!this.speechSynth || !this.vozHabilitada) return;

    this.speechSynth.cancel();

    let textoVoz = '';
    const guicheFormatado = guicheStr ? `, ${guicheStr}` : '';
    const nameFormatado = patientName ? `, ${patientName}` : '';

    if (senhaStr.startsWith('P')) {
      const num = senhaStr.substring(1);
      textoVoz = `Senha prioritária, P, ${num.split('').join(' ')}${nameFormatado}${guicheFormatado}`;
    } else if (senhaStr.startsWith('N')) {
      const num = senhaStr.substring(1);
      textoVoz = `Senha normal, N, ${num.split('').join(' ')}${nameFormatado}${guicheFormatado}`;
    } else {
      textoVoz = `Senha, ${senhaStr.split('').join(' ')}${nameFormatado}${guicheFormatado}`;
    }

    let count = 0;

    const falarUmaVez = () => {
      if (count >= repeticoes) return;
      count++;

      const utterance = new SpeechSynthesisUtterance(textoVoz);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        if (count < repeticoes) {
          setTimeout(falarUmaVez, 400);
        }
      };

      utterance.onerror = () => {
        if (count < repeticoes) {
          setTimeout(falarUmaVez, 400);
        }
      };

      this.speechSynth.speak(utterance);
    };

    falarUmaVez();
  }

  updateConnectionStatus(isOnline, text) {
    if (this.dom.statusDot) {
      this.dom.statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
    if (this.dom.statusText) {
      this.dom.statusText.textContent = text;
    }
  }

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

  initTheme() {
    const savedTheme = localStorage.getItem('chama_senha_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chamaSenhaTV = new ChamaSenhaTV();
});
