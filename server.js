const express = require('express');
const http = require('http');
const { Server } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

const PORT = process.env.PORT || 8080;

// Статика для фронтенда
app.use(express.static(path.join(__dirname, 'public')));

// Обработка подключений WebSocket
wss.on('connection', (ws) => {
  console.log('Новое подключение');

  ws.on('message', (message) => {
    console.log('Сообщение:', message.toString());
    // Рассылаем всем клиентам
    wss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Клиент отключился');
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
