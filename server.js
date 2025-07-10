const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

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

// Middleware для проверки авторизации
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// ===== 🔐 Аутентификация =====

// Страница входа
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Обработка входа
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (user) {
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.user = {
  email: user.email,
  access: user.access,
  grades: user.grades || {},
  name: user.name || ''
};

      return res.redirect('/cabinet');
    }
  }
  res.render('login', { error: 'Неверный email или пароль' });
});

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ===== 👤 Кабинет =====

app.get('/cabinet', requireLogin, async (req, res) => {
  const user = req.session.user;
  const courseId = user.courseId;

  // Уроки
  const { data: lessonsData, error: lessonsError } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('order_number');

  // Название курса
  const { data: courseData } = await supabase
    .from('courses')
    .select('title')
    .eq('id', courseId)
    .single();

  const availableLessons = lessonsData.map(lesson => ({
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
    courseName: courseData?.title || 'Ваш курс',
    progress
  });
});


// ===== 📖 Урок =====

app.get('/lesson/:id', requireLogin, (req, res) => {
  const lessonId = req.params.id;
  if (!req.session.user.access.includes(lessonId)) {
    return res.status(403).send('⛔ У вас нет доступа к этому уроку');
  }
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return res.status(404).send('Урок не найден');
  res.render('lesson', { lesson });
});

// ===== 📦 Защищённая отдача уроков =====

app.get('/protected-lesson/:lessonId', requireLogin, (req, res) => {
  const lessonId = req.params.lessonId;
  if (!req.session.user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа');
  }

  const filePath = path.join(__dirname, 'lessons', lessonId, 'index.html');
  if (!fs.existsSync(filePath)) return res.status(404).send('Урок не найден');

  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/href="style.css"/g, `href="/protected-lesson/${lessonId}/style.css"`);
  html = html.replace(/src="script.js"/g, `src="/protected-lesson/${lessonId}/script.js"`);
  html = html.replace(/src="audioL1\//g, `src="/protected-lesson/${lessonId}/audioL1/`);
  res.send(html);
});

app.get('/protected-lesson/:lessonId/*', requireLogin, (req, res) => {
  const lessonId = req.params.lessonId;
  if (!req.session.user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к файлу');
  }

  const requestedPath = req.params[0];
  const filePath = path.join(__dirname, 'lessons', lessonId, requestedPath);
  if (!fs.existsSync(filePath)) return res.status(404).send('⛔ Файл не найден');
  res.sendFile(filePath);
});

// ===== 🌐 Домашняя =====

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/cabinet');
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`✅ Сервер запущен на http://localhost:${port}`);
});
