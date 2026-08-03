/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SERVIDOR BACKEND ENTERPRISE (NODE.JS REAL-TIME)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Servidor HTTP & WebSocket Nativo com suporte a Nome do Paciente,
 *            Estados de Atendimento (TME/TMA), Métricas BI (/api/metrics)
 *            e Persistência em Disco em data/state.json.
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function getTodayDateString() {
  const now = new Date();
  return now.toLocaleDateString('pt-BR');
}

function createInitialState() {
  return {
    dailyDate: getTodayDateString(),
    senhaNormalCount: 0,
    senhaPrioridadedCount: 0,
    senhaAtualText: 'N000',
    ultimaSenhaText: 'N000',
    guicheAtual: 'Recepção',
    tipoAtendimento: 'Aguardando Chamada',
    patientNameAtual: '',
    queue: [],
    historico: [],
    completedTickets: [],
    somHabilitado: true,
    vozHabilitada: true
  };
}

let appState = createInitialState();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPersistedState() {
  try {
    ensureDataDir();
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      
      const today = getTodayDateString();
      if (loaded.dailyDate !== today) {
        console.log(`[ChamaSenha Enterprise]: Novo dia detectado (${today}). Resetando contadores diários...`);
        appState = createInitialState();
        saveStateToDisk();
      } else {
        appState = { ...createInitialState(), ...loaded };
        if (appState.senhaAtualText === '0000') appState.senhaAtualText = 'N000';
        if (appState.ultimaSenhaText === '0000') appState.ultimaSenhaText = 'N000';
        appState.historico = (appState.historico || []).slice(0, 3);
        console.log('[ChamaSenha Enterprise]: Estado carregado do disco com sucesso.');
      }
    } else {
      saveStateToDisk();
    }
  } catch (err) {
    console.error('[ChamaSenha Error]: Falha ao carregar estado:', err);
  }
}

function saveStateToDisk() {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ChamaSenha Error]: Falha ao salvar estado:', err);
  }
}

function checkDailyReset() {
  const today = getTodayDateString();
  if (appState.dailyDate !== today) {
    console.log(`[ChamaSenha Auto-Reset]: Virada de dia (${today}). Resetando contadores...`);
    appState = createInitialState();
    saveStateToDisk();
    broadcastMessage({ type: 'TICKETS_RESET', payload: appState });
  }
}

function calculateMetrics() {
  const completed = appState.completedTickets || [];
  const totalTickets = (appState.queue ? appState.queue.length : 0) + completed.length;

  let totalWaitMs = 0;
  let waitCount = 0;
  let totalServiceMs = 0;
  let serviceCount = 0;
  let absentCount = 0;

  completed.forEach(t => {
    if (t.status === 'ABSENT') absentCount++;
    if (t.createdAt && t.calledAt) {
      const wait = new Date(t.calledAt) - new Date(t.createdAt);
      if (wait >= 0) {
        totalWaitMs += wait;
        waitCount++;
      }
    }
    if (t.startedAt && t.endedAt) {
      const service = new Date(t.endedAt) - new Date(t.startedAt);
      if (service >= 0) {
        totalServiceMs += service;
        serviceCount++;
      }
    }
  });

  const avgWaitMin = waitCount > 0 ? Math.round((totalWaitMs / waitCount) / 60000) : 0;
  const avgServiceMin = serviceCount > 0 ? Math.round((totalServiceMs / serviceCount) / 60000) : 0;

  return {
    dailyDate: appState.dailyDate,
    totalIssued: appState.senhaNormalCount + appState.senhaPrioridadedCount,
    totalQueue: appState.queue ? appState.queue.length : 0,
    totalCompleted: completed.length,
    totalAbsent: absentCount,
    avgWaitMin,
    avgServiceMin,
    completedTickets: completed
  };
}

loadPersistedState();
setInterval(checkDailyReset, 60000);

const clients = new Set();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  checkDailyReset();

  if (req.url === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(appState));
  }

  if (req.url === '/api/metrics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(calculateMetrics()));
  }

  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Acesso negado');
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Arquivo não encontrado');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Erro no servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  const secWsKey = req.headers['sec-websocket-key'];
  if (!secWsKey) {
    socket.destroy();
    return;
  }

  const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const acceptKey = crypto
    .createHash('sha1')
    .update(secWsKey + GUID)
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(headers.join('\r\n') + '\r\n\r\n');
  clients.add(socket);

  sendWebSocketFrame(socket, JSON.stringify({ type: 'INIT_STATE', payload: appState }));

  socket.on('data', (buffer) => {
    try {
      const message = parseWebSocketFrame(buffer);
      if (message) handleClientMessage(socket, message);
    } catch (e) {}
  });

  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});

function handleClientMessage(senderSocket, message) {
  try {
    const data = JSON.parse(message);
    checkDailyReset();

    switch (data.type) {
      case 'ISSUE_TICKET': {
        const { type, destination, patientName } = data.payload || {};
        let newTicketId = '';

        if (type === 'PRIORIDADE') {
          appState.senhaPrioridadedCount += 1;
          newTicketId = 'P' + String(appState.senhaPrioridadedCount).padStart(3, '0');
        } else {
          appState.senhaNormalCount += 1;
          newTicketId = 'N' + String(appState.senhaNormalCount).padStart(3, '0');
        }

        const ticketObj = {
          id: newTicketId,
          type: type || 'NORMAL',
          destination: destination || 'Geral',
          patientName: (patientName || '').trim(),
          createdAt: new Date().toISOString(),
          status: 'WAITING'
        };

        appState.queue.push(ticketObj);
        saveStateToDisk();

        broadcastMessage({ type: 'TICKET_ISSUED', payload: { newTicket: ticketObj, state: appState } });
        break;
      }

      case 'CALL_NEXT': {
        const { destination, specificTicketId } = data.payload || {};
        let ticketToCall = null;

        if (specificTicketId) {
          const index = appState.queue.findIndex(t => t.id === specificTicketId);
          if (index !== -1) {
            ticketToCall = appState.queue.splice(index, 1)[0];
          }
        } else if (destination && destination !== 'Geral') {
          let index = appState.queue.findIndex(t => t.destination === destination && t.type === 'PRIORIDADE');
          if (index === -1) index = appState.queue.findIndex(t => t.destination === destination);
          if (index === -1) index = appState.queue.findIndex(t => t.type === 'PRIORIDADE');
          if (index === -1 && appState.queue.length > 0) index = 0;

          if (index !== -1) {
            ticketToCall = appState.queue.splice(index, 1)[0];
          }
        } else {
          let index = appState.queue.findIndex(t => t.type === 'PRIORIDADE');
          if (index === -1 && appState.queue.length > 0) index = 0;

          if (index !== -1) {
            ticketToCall = appState.queue.splice(index, 1)[0];
          }
        }

        if (ticketToCall) {
          if (appState.senhaAtualText && appState.senhaAtualText !== 'N000' && appState.senhaAtualText !== '0000') {
            appState.ultimaSenhaText = appState.senhaAtualText;
          }

          ticketToCall.calledAt = new Date().toISOString();
          ticketToCall.status = 'CALLED';
          ticketToCall.destination = destination || ticketToCall.destination || 'Recepção';

          appState.currentTicket = ticketToCall;
          appState.senhaAtualText = ticketToCall.id;
          appState.patientNameAtual = ticketToCall.patientName || '';
          appState.guicheAtual = ticketToCall.destination;
          appState.tipoAtendimento = ticketToCall.type === 'PRIORIDADE' ? 'Atendimento Prioritário' : 'Atendimento Normal';

          const historyText = ticketToCall.patientName 
            ? `${ticketToCall.id} (${ticketToCall.patientName}) - ${appState.guicheAtual}`
            : `${ticketToCall.id} - ${appState.guicheAtual}`;

          const historyEntry = {
            ticketId: ticketToCall.id,
            patientName: ticketToCall.patientName,
            destination: appState.guicheAtual,
            text: historyText
          };

          if (!appState.historico.length || appState.historico[0].ticketId !== ticketToCall.id) {
            appState.historico.unshift(historyEntry);
            if (appState.historico.length > 3) appState.historico.pop();
          }

          saveStateToDisk();
          broadcastMessage({ type: 'TICKET_CALLED', payload: appState });
        } else {
          broadcastMessage({ type: 'QUEUE_EMPTY', payload: appState });
        }
        break;
      }

      case 'START_SERVICE': {
        const { ticketId } = data.payload || {};
        if (appState.currentTicket && appState.currentTicket.id === ticketId) {
          appState.currentTicket.startedAt = new Date().toISOString();
          appState.currentTicket.status = 'IN_SERVICE';
          saveStateToDisk();
          broadcastMessage({ type: 'SERVICE_STARTED', payload: appState });
        }
        break;
      }

      case 'COMPLETE_SERVICE': {
        const { ticketId } = data.payload || {};
        if (appState.currentTicket && appState.currentTicket.id === ticketId) {
          appState.currentTicket.endedAt = new Date().toISOString();
          appState.currentTicket.status = 'COMPLETED';
          
          if (!appState.completedTickets) appState.completedTickets = [];
          appState.completedTickets.push(appState.currentTicket);
          
          saveStateToDisk();
          broadcastMessage({ type: 'SERVICE_COMPLETED', payload: appState });
        }
        break;
      }

      case 'MARK_ABSENT': {
        const { ticketId } = data.payload || {};
        if (appState.currentTicket && appState.currentTicket.id === ticketId) {
          appState.currentTicket.endedAt = new Date().toISOString();
          appState.currentTicket.status = 'ABSENT';

          if (!appState.completedTickets) appState.completedTickets = [];
          appState.completedTickets.push(appState.currentTicket);

          saveStateToDisk();
          broadcastMessage({ type: 'SERVICE_ABSENT', payload: appState });
        }
        break;
      }

      case 'REDIRECT_TICKET': {
        const { ticketId, newDestination } = data.payload || {};
        if (appState.currentTicket && appState.currentTicket.id === ticketId) {
          const redirectedObj = {
            ...appState.currentTicket,
            destination: newDestination,
            status: 'WAITING',
            redirectedFrom: appState.currentTicket.destination
          };

          appState.queue.push(redirectedObj);
          saveStateToDisk();
          broadcastMessage({ type: 'TICKET_REDIRECTED', payload: { redirectedTicket: redirectedObj, state: appState } });
        }
        break;
      }

      case 'REPEAT_CALL': {
        broadcastMessage({ type: 'TICKET_REPEATED', payload: appState });
        break;
      }

      case 'RESET_TICKETS': {
        appState = createInitialState();
        saveStateToDisk();
        broadcastMessage({ type: 'TICKETS_RESET', payload: appState });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[Server Error]: Falha ao processar comando:', err);
  }
}

function broadcastMessage(data) {
  const jsonString = JSON.stringify(data);
  for (const client of clients) {
    if (client.writable) sendWebSocketFrame(client, jsonString);
  }
}

function sendWebSocketFrame(socket, text) {
  const payload = Buffer.from(text, 'utf-8');
  const length = payload.length;

  let header;
  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = length;
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const opcode = buffer[0] & 0x0f;
  if (opcode !== 0x1) return null;

  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!isMasked) return null;

  const maskingKey = buffer.slice(offset, offset + 4);
  offset += 4;

  if (buffer.length < offset + payloadLength) return null;

  const payload = buffer.slice(offset, offset + payloadLength);
  const unmasked = Buffer.alloc(payloadLength);

  for (let i = 0; i < payloadLength; i++) {
    unmasked[i] = payload[i] ^ maskingKey[i % 4];
  }

  return unmasked.toString('utf-8');
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SERVIDOR CHAMA SENHA ENTERPRISE EXECUTANDO!`);
  console.log(`====================================================`);
  console.log(`📍 Recepção / Triagem:   http://localhost:${PORT}/index.html`);
  console.log(`👨‍⚕️ Painel do Consultório: http://localhost:${PORT}/atendimento.html`);
  console.log(`📺 Exibição para TV:     http://localhost:${PORT}/tv.html`);
  console.log(`📊 Relatórios & BI:      http://localhost:${PORT}/relatorios.html`);
  console.log(`====================================================`);
});
