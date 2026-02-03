const express = require('express');
const path = require('path');

const app = express();
const PORT = 4000;

// Serve frontend files
app.use(express.static(path.join(__dirname)));

// 404 fallback – index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║      🖥️  RETRO TERMINAL CHAT FRONTEND ONLINE 🖥️            ║
╚════════════════════════════════════════════════════════════╝
📡 Frontend listening on 0.0.0.0:${PORT}
🌐 Open: http://localhost:${PORT}
  `);
});