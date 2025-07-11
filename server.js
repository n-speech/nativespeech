require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Загружаем локальную базу (users и уроки)
const database = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
const users = database.users;
const lessons = database.lessons;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'мой_секрет',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.urlencoded({ extended: true }));

// === 🔐 Авторизация Log in ===

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (user) {
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.user = {
        email: user.email,
        name: user.name || '',
        access: user.access || [],
        grades: user.grades || {},
        course_id: user.course_id || null
      };
      return res.redirect('/cabinet');
    }
  }

  res.render('login', { error: 'Неверный email или пароль' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// === 👤 Кабинет ===

app.get('/cabinet', requireLogin, (req, res) => {
  const user = req.session.user;
  const course_id = user.course_id;

  if (!course_id) return res.send('❗ У вас не задан курс');

  const courseName = 'Ваш курс';

  const availableLessons = lessons
    .filter(lesson => lesson.course_id === course_id)
    .map(lesson => ({
      ...lesson,
      access: user.access.includes(lesson.id),
      grade: user.grades[lesson.id] || null
    }));

  const total = availableLessons.length;
  const completed = availableLessons.filter(l => l.grade).length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  res.render('cabinet', {
    user,
    lessons: availableLessons,
    courseName,
    progress
  });
});

// === 📖 Отдача HTML-файла урока из папки lessons/lessonId/index.html ===

app.get('/lesson/:id', requireLogin, (req, res) => {
  const lessonId = req.params.id;

  if (!req.session.user.access.includes(lessonId)) {
    return res.status(403).send('⛔ У вас нет доступа к этому уроку');
  }

  const filePath = path.join(__dirname, 'lessons', lessonId, 'index.html');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Урок не найден');
  }

  res.sendFile(filePath);
});

// === Отдача вспомогательных файлов урока (css, js, аудио) ===

app.get('/lesson/:lessonId/*', requireLogin, (req, res) => {
  const lessonId = req.params.lessonId;
  const filePath = path.join(__dirname, 'lessons', lessonId, req.params[0]);

  if (!req.session.user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к файлу');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('⛔ Файл не найден');
  }

  res.sendFile(filePath);
});

// === Главная ===

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/cabinet');
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`✅ Сервер запущен на http://localhost:${port}`);
});
