/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SERVIDOR BACKEND (NODE.JS REAL-TIME)
 * ============================================================================
 * Servidor HTTP e WebSocket nativo sem dependências externas.
 * Fornece arquivos estáticos e sincroniza eventos de chamada de senha entre
 * múltiplos dispositivos conectados na mesma rede local (LAN).
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// Estado centralizado do servidor
let appState = {
  senhaNormal: 0,
  senhaPrioridade: 0,
  senhaAtualText: '0000',
  ultimaSenhaText: '0000',
  guicheAtual: 'Guichê 01',
  tipoAtendimento: 'Aguardando Chamada',
  historico: []
};

// Lista de conexões WebSocket ativas
const clients = new Set();

/**
 * Mapeamento de tipos MIME para arquivos estáticos
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

/**
 * Trata requisições HTTP servindo os arquivos estáticos da aplicação
 */
const server = http.createServer((req, res) => {
  // Rota de API para consultar estado atual via HTTP REST
  if (req.url === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(appState));
  }

  // Normalização do caminho do arquivo solicitado
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Prevenção contra Directory Traversal
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

/**
 * Trata Upgrade de Conexão HTTP para protocolo WebSocket (RFC 6455)
 */
server.on('upgrade', (req, socket, head) => {
  const secWsKey = req.headers['sec-websocket-key'];
  if (!secWsKey) {
    socket.destroy();
    return;
  }

  // Geração da chave WebSocket Sec-WebSocket-Accept
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

  // Adiciona a socket aos clientes ativos
  clients.add(socket);

  // Envia o estado inicial para o novo cliente conectado
  sendWebSocketFrame(socket, JSON.stringify({ type: 'INIT_STATE', payload: appState }));

  socket.on('data', (buffer) => {
    try {
      const message = parseWebSocketFrame(buffer);
      if (message) {
        handleClientMessage(socket, message);
      }
    } catch (e) {
      // Ignora frames malformados ou fechamentos
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
});

/**
 * Processa mensagens recebidas dos clientes WebSocket
 */
function handleClientMessage(senderSocket, message) {
  try {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'CALL_TICKET':
        appState = { ...appState, ...data.payload };
        broadcastMessage({ type: 'TICKET_CALLED', payload: appState });
        break;

      case 'REPEAT_CALL':
        broadcastMessage({ type: 'TICKET_REPEATED', payload: appState });
        break;

      case 'RESET_TICKETS':
        appState = {
          senhaNormal: 0,
          senhaPrioridade: 0,
          senhaAtualText: '0000',
          ultimaSenhaText: '0000',
          guicheAtual: 'Guichê 01',
          tipoAtendimento: 'Aguardando Chamada',
          historico: []
        };
        broadcastMessage({ type: 'TICKETS_RESET', payload: appState });
        break;

      default:
        break;
    }
  } catch (err) {
    console.error('[Server Error]: Falha ao processar mensagem WS:', err);
  }
}

/**
 * Transmite uma mensagem para todos os clientes WebSocket conectados
 */
function broadcastMessage(data) {
  const jsonString = JSON.stringify(data);
  for (const client of clients) {
    if (client.writable) {
      sendWebSocketFrame(client, jsonString);
    }
  }
}

/**
 * Auxiliar: Codifica e envia um Frame WebSocket de Texto (Opcode 0x1)
 */
function sendWebSocketFrame(socket, text) {
  const payload = Buffer.from(text, 'utf-8');
  const length = payload.length;

  let header;
  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN = 1, Opcode = 1 (text)
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

/**
 * Auxiliar: Decodifica um Frame WebSocket vindo do Cliente
 */
function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;
  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!isMasked) return null; // Clientes conforme especificação devem mascarar mensagens

  const maskingKey = buffer.slice(offset, offset + 4);
  offset += 4;

  const payload = buffer.slice(offset, offset + payloadLength);
  const unmasked = Buffer.alloc(payloadLength);

  for (let i = 0; i < payloadLength; i++) {
    unmasked[i] = payload[i] ^ maskingKey[i % 4];
  }

  return unmasked.toString('utf-8');
}

// Inicialização do Servidor
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SERVIDOR CHAMA SENHA EXECUTANDO COM SUCESSO!`);
  console.log(`====================================================`);
  console.log(`📍 Painel do Operador: http://localhost:${PORT}/index.html`);
  console.log(`📺 Exibição para TV:   http://localhost:${PORT}/tv.html`);
  console.log(`====================================================`);
});
