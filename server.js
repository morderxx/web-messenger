const express = require('express');
const http = require('http');
const { Server } = require('ws');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

const PORT = process.env.PORT || 8080;
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Подключение к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Middleware
app.use(cors());
app.use(express.json());

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'Регистрация успешна', userId: result.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Авторизация
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Неверный пароль' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });

    res.json({ message: 'Авторизация успешна', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Middleware для проверки токена
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Защищённый маршрут (пример)
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// WebSocket подключения
wss.on('connection', (ws) => {
  console.log('Новое подключение по WebSocket');

  ws.on('message', (message) => {
    console.log('Сообщение:', message.toString());

    // Рассылаем сообщение всем подключённым
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
