const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Настройка сессий
app.use(session({
  secret: 'мой_секрет_для_подписания_куки',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // в dev без https
}));

// Парсинг тела формы
app.use(express.urlencoded({ extended: true }));

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- "База" пользователей (в памяти)
const users = {
  'user@example.com': { password: 'password123', email: 'user@example.com' }
};

// --- Данные уроков (тоже для примера)
const lessonsData = {
  lesson1: { id: 'lesson1', title: 'Урок 1: Французский алфавит' }
};

// --- Middleware проверки авторизации
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// --- Роуты

// Страница входа
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Обработка входа
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (user && user.password === password) {
    req.session.user = user;
    return res.redirect('/cabinet');
  }
  res.render('login', { error: 'Неверный email или пароль' });
});

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Личный кабинет
app.get('/cabinet', requireLogin, (req, res) => {
  res.render('cabinet', { user: req.session.user, lessons: Object.values(lessonsData) });
});

// Страница урока с iframe
app.get('/lesson/:id', requireLogin, (req, res) => {
  const lesson = lessonsData[req.params.id];
  if (!lesson) {
    return res.status(404).send('Урок не найден');
  }
  res.render('lesson', { lesson });
});

// Защищённая выдача index.html с подменой путей
app.get('/protected-lesson/:lessonId', requireLogin, (req, res) => {
  const lessonId = req.params.lessonId;
  const filePath = path.join(__dirname, 'lessons', lessonId, 'index.html');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Урок не найден');
  }
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/href="style.css"/g, `href="/protected-lesson/${lessonId}/style.css"`);
  html = html.replace(/src="script.js"/g, `src="/protected-lesson/${lessonId}/script.js"`);
  html = html.replace(/src="audioL1\//g, `src="/protected-lesson/${lessonId}/audioL1/`);
  res.send(html);
});

// Защищённая выдача всех файлов урока (CSS, JS, аудио)
app.get('/protected-lesson/:lessonId/*', requireLogin, (req, res) => {
  const lessonId = req.params.lessonId;
  const requestedPath = req.params[0];
  const filePath = path.join(__dirname, 'lessons', lessonId, requestedPath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Файл не найден');
  }
  res.sendFile(filePath);
});

// Главная редиректит на кабинет или логин
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/cabinet');
  } else {
    res.redirect('/login');
  }
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
