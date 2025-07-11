const express = require('express');
const path = require('path');
const fs = require('fs');
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

// 🔐 Страница логина
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 🔐 Обработка логина (временно без bcrypt)
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.render('login', { error: 'Пользователь не найден' });

  // Временно: проверка обычного пароля
  if (password !== '12345') {
    return res.render('login', { error: 'Неверный пароль' });
  }

  req.session.user = {
    email: user.email,
    name: user.name || '',
    course: user.course || null
    access: user.access || []
  };

  res.redirect('/cabinet');
});

// 👤 Кабинет
app.get('/cabinet', requireLogin, (req, res) => {
  const user = req.session.user;

  const availableLessons = lessons.map(lesson => ({
    ...lesson,
    access: user.access.includes(lesson.id),
    grade: lesson.grade || null
  }));

  const total = availableLessons.length;
  const completed = availableLessons.filter(l => l.grade).length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const courseName = user.course || 'Ваш курс';

  res.render('cabinet', { user, lessons: availableLessons, courseName, progress });
});

// 📦 Урок (index.html)
app.get('/lesson/:id', requireLogin, (req, res) => {
  const lessonId = req.params.id;
  const user = req.session.user;

  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к уроку');
  }

  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return res.status(404).send('⛔ Урок не найден');

  const filePath = path.join(__dirname, 'lessons', lesson.file);
  if (!fs.existsSync(filePath)) return res.status(404).send('⛔ Файл урока не найден');

  res.sendFile(filePath);
});

// 📦 Защищённая статика для урока
app.use('/lesson/:id/static', requireLogin, (req, res, next) => {
  const lessonId = req.params.id;
  const user = req.session.user;

  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к файлам');
  }

  const staticPath = path.join(__dirname, 'lessons', lessonId);
  express.static(staticPath)(req, res, next);
});

// 🚪 Выход
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// 🏠 Главная
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/cabinet');
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`✅ Сервер запущен: http://localhost:${port}`);
});
