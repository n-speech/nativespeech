const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;

const db = new sqlite3.Database(path.join(__dirname, 'data', 'data.db'), (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе:', err.message);
  } else {
    console.log('✅ Подключено к базе данных SQLite');
  }
});


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

// 🔐 Обработка логина
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'Пользователь не найден' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Неверный пароль' });
    }

    // Получаем доступные уроки для пользователя
    db.all('SELECT lesson_id FROM user_access WHERE email = ?', [email], (err, rows) => {
      const access = rows.map(r => r.lesson_id);

      req.session.user = {
        email: user.email,
        name: user.name || '',
        course_id: user.course_id,
        access
      };

      res.redirect('/cabinet');
    });
  });
});

// 👤 Кабинет
app.get('/cabinet', requireLogin, (req, res) => {
  const user = req.session.user;

  db.get('SELECT title FROM courses WHERE id = ?', [user.course_id], (err, course) => {
    const courseName = course ? course.title : 'Ваш курс';

    db.all('SELECT * FROM lessons WHERE course_id = ?', [user.course_id], (err, lessons) => {
      if (err) return res.send('❌ Ошибка загрузки уроков');

      const availableLessons = lessons.map(lesson => ({
        ...lesson,
        access: user.access.includes(lesson.id),
        grade: lesson.grade || null
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
  });
});

// 📦 Урок (index.html)
app.get('/lesson/:id', requireLogin, (req, res) => {
  const lessonId = req.params.id;
  const user = req.session.user;

  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к уроку');
  }

  db.get('SELECT * FROM lessons WHERE id = ?', [lessonId], (err, lesson) => {
    if (!lesson) return res.status(404).send('⛔ Урок не найден');

    const filePath = path.join(__dirname, 'lessons', lesson.file);
    if (!fs.existsSync(filePath)) return res.status(404).send('⛔ Файл урока не найден');

    res.sendFile(filePath);
  });
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
