class RetroTerminalChat {
  constructor() {
    this.ws = null;
    this.username = null;
    this.messageCount = 0;
    this.connectedTime = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;

    this.elements = {
      terminal: document.getElementById('terminal'),
      input: document.getElementById('message-input'),
      usernameDisplay: document.getElementById('username-display'),
      onlineCount: document.getElementById('online-count'),
      messageCount: document.getElementById('message-count'),
      wsStatus: document.getElementById('ws-status'),
      connectionTime: document.getElementById('connection-time'),
      commandHint: document.getElementById('command-hint'),
    };

    this.init();
  }

  init() {
    this.connect();
    this.setupEventListeners();
    this.startConnectionTimer();
    this.setupHeartbeat();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => this.onOpen();
      this.ws.onmessage = (event) => this.onMessage(event);
      this.ws.onerror = () => this.onError();
      this.ws.onclose = () => this.onClose();
    } catch (err) {
      console.error('Connection error:', err);
      this.scheduleReconnect();
    }
  }

  onOpen() {
    this.printLine('[SYSTEM] Connected to server...', 'system');
    this.reconnectAttempts = 0;
    this.updateStatus('CONNECTED', true);
    this.promptUsername();
  }

  onMessage(event) {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'welcome':
          this.handleWelcome(data);
          break;
        case 'message':
          this.displayMessage(data);
          break;
        case 'system':
          this.displaySystemMessage(data);
          break;
        case 'error':
          this.printLine(data.message, 'error');
          break;
        case 'pong':
          break;
      }
    } catch (err) {
      console.error('Message parse error:', err);
    }
  }

  onError() {
    this.updateStatus('ERROR', false);
    this.printLine('[SYSTEM] WebSocket error occurred', 'error');
  }

  onClose() {
    this.updateStatus('DISCONNECTED', false);
    this.printLine('[SYSTEM] Disconnected from server', 'error');
    this.scheduleReconnect();
  }

  promptUsername() {
    this.elements.input.placeholder = 'Enter username (or press Enter for random):';
    this.elements.input.disabled = false;
    this.elements.input.focus();

    const handler = (e) => {
      if (e.key === 'Enter') {
        const username = this.elements.input.value.trim() || `user-${Math.random().toString(36).substring(7)}`;
        this.elements.input.removeEventListener('keydown', handler);
        this.registerUsername(username);
      }
    };

    this.elements.input.addEventListener('keydown', handler);
  }

  registerUsername(username) {
    this.username = username.substring(0, 16);
    this.ws.send(JSON.stringify({
      type: 'register',
      username: this.username,
    }));

    this.elements.input.value = '';
    this.elements.input.placeholder = 'Type message or /help for commands...';
    this.elements.input.disabled = false;
    this.elements.usernameDisplay.textContent = `● ${this.username}`;
    this.elements.input.focus();
  }

  handleWelcome(data) {
    this.printLine('═══════════════════════════════════════════════════════', 'system');
    this.printLine(data.message, 'system');
    this.printLine('═══════════════════════════════════════════════════════', 'system');

    if (data.history && data.history.length > 0) {
      data.history.forEach((msg) => {
        if (msg.type === 'system') {
          this.displaySystemMessage(msg);
        } else if (msg.type === 'message') {
          this.displayMessage(msg);
        }
      });
    }

    if (data.onlineCount) {
      this.updateOnlineCount(data.onlineCount);
    }
  }

  displayMessage(data) {
    const line = `${this.formatTime(data.timestamp)} [${data.username}] ${data.message}`;
    this.printLine(line, 'message', data.color);
    this.messageCount++;
    this.elements.messageCount.textContent = this.messageCount;
  }

  displaySystemMessage(data) {
    const line = `${this.formatTime(data.timestamp)} [SYSTEM] ${data.message}`;
    this.printLine(line, 'system');

    if (data.onlineCount !== undefined) {
      this.updateOnlineCount(data.onlineCount);
    }
  }

  updateOnlineCount(count) {
    this.elements.onlineCount.textContent = `Online: ${count}`;
  }

  printLine(text, type = 'message', color = null) {
    const line = document.createElement('div');
    line.className = `message ${type}-message`;

    let colored = text;
    if (color && color.includes('\x1b')) {
      colored = text.replace(/\x1b\[\d+m/g, '');
    }

    line.textContent = colored;
    this.elements.terminal.appendChild(line);
    this.elements.terminal.scrollTop = this.elements.terminal.scrollHeight;
  }

  formatTime(timestamp) {
    return timestamp || new Date().toLocaleTimeString();
  }

  setupEventListeners() {
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.elements.input.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value.startsWith('/')) {
        this.updateCommandHint(value);
      } else {
        this.elements.commandHint.textContent = '';
      }
    });
  }

  updateCommandHint(command) {
    const hints = {
      '/help': 'Show available commands',
      '/clear': 'Clear terminal',
      '/time': 'Show current time',
      '/count': 'Show message count',
    };

    for (const [cmd, hint] of Object.entries(hints)) {
      if (cmd.startsWith(command)) {
        this.elements.commandHint.textContent = `→ ${hint}`;
        return;
      }
    }
  }

  sendMessage() {
    const message = this.elements.input.value.trim();
    if (!message) return;

    if (message.startsWith('/')) {
      this.handleCommand(message);
    } else {
      this.ws.send(JSON.stringify({
        type: 'message',
        message: message,
      }));
    }

    this.elements.input.value = '';
    this.elements.commandHint.textContent = '';
  }

  handleCommand(command) {
    const cmd = command.toLowerCase();

    if (cmd === '/help') {
      this.printLine('Available commands:', 'system');
      this.printLine('  /help    - Show this help', 'system');
      this.printLine('  /clear   - Clear terminal', 'system');
      this.printLine('  /time    - Show server time', 'system');
      this.printLine('  /count   - Show message count', 'system');
    } else if (cmd === '/clear') {
      this.elements.terminal.innerHTML = '';
      this.messageCount = 0;
      this.elements.messageCount.textContent = '0';
    } else if (cmd === '/time') {
      const now = new Date().toLocaleTimeString();
      this.printLine(`Server time: ${now}`, 'system');
    } else if (cmd === '/count') {
      this.printLine(`Total messages: ${this.messageCount}`, 'system');
    } else {
      this.printLine('Unknown command. Type /help for available commands.', 'error');
    }
  }

  updateStatus(status, isOk) {
    this.elements.wsStatus.textContent = status;
    this.elements.wsStatus.className = `status-${isOk ? 'ok' : 'error'}`;
  }

  startConnectionTimer() {
    setInterval(() => {
      if (this.connectedTime) {
        const elapsed = Math.floor((Date.now() - this.connectedTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        this.elements.connectionTime.textContent = 
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);

    this.connectedTime = Date.now();
  }

  setupHeartbeat() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      this.printLine(`[SYSTEM] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'error');
      setTimeout(() => this.connect(), delay);
    } else {
      this.printLine('[SYSTEM] Connection lost. Max reconnection attempts reached.', 'error');
      this.elements.input.disabled = true;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RetroTerminalChat();
});