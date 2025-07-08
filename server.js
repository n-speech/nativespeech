const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());

// 🔐 Главная точка входа: отдать index.html c подменой путей
app.get('/protected-lesson/:lessonId', (req, res) => {
  const token = req.cookies['sb-access-token'];
  if (!token) {
    return res.status(401).send('⛔ Нет доступа: вы не авторизованы');
  }

  const lessonId = req.params.lessonId;
  const filePath = path.join(__dirname, 'lessons', lessonId, 'index.html');

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('⛔ Урок не найден');
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // 🔁 Заменим пути в HTML на защищённые
  html = html.replace(/href="style.css"/g, `href="/protected-lesson/${lessonId}/style.css"`);
  html = html.replace(/src="script.js"/g, `src="/protected-lesson/${lessonId}/script.js"`);
  html = html.replace(/src="audioL1\//g, `src="/protected-lesson/${lessonId}/audioL1/`);

  res.send(html);
});

// 🔐 Защищённая подгрузка любых файлов: CSS, JS, MP3 и т.д.
app.get('/protected-lesson/:lessonId/*', (req, res) => {
  const token = req.cookies['sb-access-token'];
  if (!token) {
    return res.status(401).send('⛔ Нет доступа к файлу');
  }

  const lessonId = req.params.lessonId;
  const requestedPath = req.params[0]; // всё, что после /:lessonId/
  const filePath = path.join(__dirname, 'lessons', lessonId, requestedPath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('⛔ Файл не найден');
  }

  res.sendFile(filePath);
});

// 🏠 Проверка сервера
app.get('/', (req, res) => {
  res.send(`<h2>Сервер работает</h2><p>Попробуйте <a href="/protected-lesson/lesson1">перейти к уроку</a></p>`);
});

app.listen(port, () => {
  console.log(`✅ Сервер запущен на http://localhost:${port}`);
});
