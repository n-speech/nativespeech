const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = 3000;

// Загружаем базу
const database = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
const users = database.users;
const lessons = database.lessons;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'секрет_сессии',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Страница логина
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Обработка логина
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.render('login', { error: 'Пользователь не найден' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.render('login', { error: 'Неверный пароль' });

  // Сохраняем в сессию
  req.session.user = {
   email: user.email,
  name: user.name || '',
  access: user.access || []
  };

  res.redirect('/cabinet');
});

// Кабинет
// Кабинет
app.get('/cabinet', requireLogin, (req, res) => {
  const user = req.session.user;

  const availableLessons = lessons.map(lesson => ({
    ...lesson,
    access: user.access.includes(lesson.id),
    grade: lesson.grade || null // Можно заменить на оценку из базы при необходимости
  }));

  const total = availableLessons.length;
  const completed = availableLessons.filter(l => l.grade).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const courseName = 'Ваш курс'; // Здесь можно вставить из базы по course_id, если она есть

  res.render('cabinet', {
    user,
    lessons: availableLessons,
    courseName,
    progress
  });
});


// Отдача урока
app.get('/lesson/:id', requireLogin, (req, res) => {
  const lessonId = req.params.id;
  const user = req.session.user;

  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ У вас нет доступа к этому уроку');
  }

  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return res.status(404).send('Урок не найден');

  const filePath = path.join(__dirname, 'lessons', lesson.file);
  res.sendFile(filePath);
});

// Отдача статичных файлов урока (css, js, audio)
app.get('/lesson/:id/*', requireLogin, (req, res) => {
  const lessonId = req.params.id;
  const fileRelative = req.params[0];
  const user = req.session.user;

  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к файлу');
  }

  const filePath = path.join(__dirname, 'lessons', lessonId, fileRelative);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Файл не найден');
  }

  res.sendFile(filePath);
});

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Главная
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/cabinet');
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`Сервер запущен http://localhost:${port}`);
});
