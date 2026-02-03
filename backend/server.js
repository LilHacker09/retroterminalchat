const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const expressStaticGzip = require('express-static-gzip');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve FRONTEND files from ../frontend
app.use('/', expressStaticGzip(path.join(__dirname, '../frontend'), {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
}));

const clients = new Map();
let messageHistory = [];
const MAX_HISTORY = 100;
const MAX_USERNAME_LENGTH = 16;
const MAX_MESSAGE_LENGTH = 512;

const COLORS = {
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  WHITE: '\x1b[37m',
  RESET: '\x1b[0m',
};

function generateUsername() {
  const adjectives = ['swift', 'lunar', 'cyber', 'neon', 'phantom', 'storm', 'zero', 'rogue', 'vortex', 'static', 'chrome', 'void'];
  const nouns = ['fox', 'hawk', 'pulse', 'sync', 'echo', 'wave', 'blade', 'drift', 'grid', 'flux', 'code', 'byte'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}-${noun}-${num}`;
}

function sanitize(input) {
  return input.substring(0, MAX_MESSAGE_LENGTH).replace(/[<>]/g, '').trim();
}

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  let clientData = {
    id: Math.random().toString(36).substring(7),
    username: null,
    color: null,
    connectedAt: Date.now(),
  };

  ws.send(JSON.stringify({
    type: 'welcome',
    message: `${COLORS.CYAN}[SYSTEM] Welcome to Retro Terminal Chat${COLORS.RESET}`,
    history: messageHistory,
    onlineCount: wss.clients.size,
  }));

  ws.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData);

      if (data.type === 'register') {
        let username = sanitize(data.username || '').substring(0, MAX_USERNAME_LENGTH);
        if (!username) {
          username = generateUsername();
        }

        const exists = Array.from(clients.values()).some(
          (c) => c.username.toLowerCase() === username.toLowerCase()
        );

        if (exists) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `${COLORS.RED}[ERROR] Username already taken${COLORS.RESET}`,
          }));
          return;
        }

        clientData.username = username;
        clientData.color = [COLORS.GREEN, COLORS.CYAN, COLORS.YELLOW, COLORS.WHITE][Math.floor(Math.random() * 4)];
        clients.set(clientData.id, clientData);

        const joinMsg = {
          type: 'system',
          timestamp: getTimestamp(),
          username: '[SYSTEM]',
          message: `${clientData.username} joined the terminal`,
          onlineCount: wss.clients.size,
        };

        messageHistory.push(joinMsg);
        if (messageHistory.length > MAX_HISTORY) {
          messageHistory.shift();
        }

        broadcast(joinMsg);
        return;
      }

      if (data.type === 'message' && clientData.username) {
        const content = sanitize(data.message);
        if (!content) return;

        const msgObj = {
          type: 'message',
          timestamp: getTimestamp(),
          username: clientData.username,
          color: clientData.color,
          message: content,
          id: clientData.id,
        };

        messageHistory.push(msgObj);
        if (messageHistory.length > MAX_HISTORY) {
          messageHistory.shift();
        }

        broadcast(msgObj);
      }

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('Message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (clientData.username) {
      clients.delete(clientData.id);

      const leaveMsg = {
        type: 'system',
        timestamp: getTimestamp(),
        username: '[SYSTEM]',
        message: `${clientData.username} left the terminal`,
        onlineCount: wss.clients.size,
      };

      messageHistory.push(leaveMsg);
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift();
      }

      broadcast(leaveMsg);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    clients: wss.clients.size,
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║      🖥️  RETRO TERMINAL CHAT SERVER ONLINE 🖥️              ║
╚════════════════════════════════════════════════════════════╝
📡 WebSocket listening on 0.0.0.0:${PORT}
🌐 HTTP Server listening on 0.0.0.0:${PORT}
📱 Frontend: http://localhost:${PORT}
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});