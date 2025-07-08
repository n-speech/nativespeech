const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cookieParser());
app.use(express.json());

// Тестовые данные уроков — замени на данные из базы
const lessonsData = {
  lesson1: { id: 'lesson1', title: 'Урок 1: Французский алфавит' },
  lesson2: { id: 'lesson2', title: 'Урок 2: Основы грамматики' },
};

// Рендер страницы урока с iframe
app.get('/lesson/:id', (req, res) => {
  const lesson = lessonsData[req.params.id];
  if (!lesson) return res.status(404).send('Урок не найден');
  res.render('lesson', { lesson });
});

// Защищённая выдача index.html с заменой путей на защищённые
app.get('/protected-lesson/:lessonId', (req, res) => {
  const token = req.cookies['sb-access-token'];
  if (!token) return res.status(401).send('⛔ Нет доступа: вы не авторизованы');

  const lessonId = req.params.lessonId;
  const filePath = path.join(__dirname, 'lessons', lessonId, 'index.html');

  if (!fs.existsSync(filePath)) return res.status(404).send('⛔ Урок не найден');

  let html = fs.readFileSync(filePath, 'utf8');

  // Замена путей в HTML
  html = html.replace(/href="style.css"/g, `href="/protected-lesson/${lessonId}/style.css"`);
  html = html.replace(/src="script.js"/g, `src="/protected-lesson/${lessonId}/script.js"`);
  html = html.replace(/src="audioL1\//g, `src="/protected-lesson/${lessonId}/audioL1/`);

  res.send(html);
});

// Защищённая выдача всех файлов урока (CSS, JS, аудио)
app.get('/protected-lesson/:lessonId/*', (req, res) => {
  const token = req.cookies['sb-access-token'];
  if (!token) return res.status(401).send('⛔ Нет доступа к файлу');

  const lessonId = req.params.lessonId;
  const requestedPath = req.params[0];
  const filePath = path.join(__dirname, 'lessons', lessonId, requestedPath);

  if (!fs.existsSync(filePath)) return res.status(404).send('⛔ Файл не найден');

  res.sendFile(filePath);
});

// Стартовая страница
app.get('/', (req, res) => {
  res.send(`
    <h2>Сервер работает</h2>
    <p>Доступные уроки:</p>
    <ul>
      ${Object.values(lessonsData).map(l => `<li><a href="/lesson/${l.id}">${l.title}</a></li>`).join('')}
    </ul>
  `);
});

app.listen(port, () => {
  console.log(`✅ Сервер запущен на http://localhost:${port}`);
});
