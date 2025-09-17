const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

// Инициализируем Express и HTTP-сервер
const app = express();
const server = http.createServer(app);

// Настраиваем CORS для разрешения запросов с любого домена (для разработки)
app.use(cors());

// Настраиваем Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*", // Разрешаем подключения с любых доменов
    methods: ["GET", "POST"]
  }
});

// Инициализируем Firebase Admin SDK
// Render сам подставит секреты из environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    "projectId": process.env.FIREBASE_PROJECT_ID,
    "privateKey": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Важно для форматирования ключа
    "clientEmail": process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com` // Старая база, но для совместимости
});

const db = admin.firestore();

// Обрабатываем подключения клиентов
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Принимаем сообщение от одного клиента и отправляем другому
  socket.on('send-message', (data) => {
    console.log('Message received:', data);
    // Сохраняем сообщение в Firestore
    db.collection('messages').add({
      text: data.text,
      from: data.from,
      to: data.to,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      // Пересылаем сообщение всем подключенным клиентам (в реальном приложении нужно отправлять только конкретному получателю)
      io.emit('receive-message', data);
    })
    .catch(error => {
      console.error('Error saving message to Firestore:', error);
    });
  });

  // Обрабатываем отключение клиента
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Запускаем сервер на порту, который предоставит Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
