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

// GET /admin (только для info@native-speech.com)
app.get('/admin', requireLogin, (req, res) => {
  if (req.session.user.email !== 'info@native-speech.com') {
    return res.status(403).send('⛔ Доступ запрещён');
  }

  res.render('admin', { message: null });
});

// POST /admin
app.post('/admin', requireLogin, (req, res) => {
  if (req.session.user.email !== 'info@native-speech.com') {
    return res.status(403).send('⛔ Доступ запрещён');
  }

  const { user_email, lesson_id, grade, access } = req.body;

  const sql = `
    INSERT INTO user_lessons (user_email, lesson_id, grade, access)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_email, lesson_id)
    DO UPDATE SET grade = excluded.grade, access = excluded.access
  `;

  db.run(sql, [user_email, lesson_id, grade, access], function (err) {
    if (err) {
      console.error('❌ Ошибка при добавлении/обновлении:', err.message);
      return res.render('admin', { message: 'Произошла ошибка при сохранении.' });
    }

    res.render('admin', { message: '✅ Данные успешно сохранены!' });
  });
});

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
      if (err) {
        return res.render('login', { error: 'Ошибка при получении доступа' });
      }

      const access = rows.map(r => r.lesson_id);

      req.session.user = {
        email: user.email,
        name: user.name || '',
        course_id: user.course_id,
        access
      };

      if (user.email === 'info@native-speech.com') {
        return res.redirect('/admin'); // Админ — на панель управления
      } else {
        return res.redirect('/cabinet'); // Все остальные — в кабинет
      }
    });
  });
});


// 👤 Кабинет — страница личного кабинета
app.get('/cabinet', requireLogin, (req, res) => {
  const user = req.session.user;

  // Сначала получаем название курса из таблицы courses
  db.get('SELECT title FROM courses WHERE id = ?', [user.course_id], (err, course) => {
    if (err) {
      console.error('❌ Ошибка при получении курса:', err);
      return res.send('❌ Ошибка загрузки курса');
    }

    const courseName = course ? course.title : 'Ваш курс';

    // Получаем все уроки курса
    db.all('SELECT * FROM lessons WHERE course_id = ?', [user.course_id], (err, lessons) => {
      if (err) {
        console.error('❌ Ошибка загрузки уроков:', err);
        return res.send('❌ Ошибка загрузки уроков');
      }

      // Загружаем оценки пользователя из таблицы user_lessons
      db.all('SELECT lesson_id, grade FROM user_lessons WHERE user_email = ?', [user.email], (err2, grades) => {
        if (err2) {
          console.error('❌ Ошибка загрузки оценок:', err2);
          return res.send('❌ Ошибка загрузки оценок');
        }

        // Создаём объект для быстрого доступа к оценкам по уроку
        const gradeMap = {};
        grades.forEach(g => {
          gradeMap[g.lesson_id] = g.grade;
        });

        // Формируем список уроков с доступом и оценкой
        const availableLessons = lessons.map(lesson => ({
          ...lesson,
          access: user.access.includes(lesson.id),
          grade: gradeMap[lesson.id] || null
        }));

        // Считаем прогресс: сколько уроков пройдено (с оценкой)
        const total = availableLessons.length;
        const completed = availableLessons.filter(l => l.grade).length;
        const progress = total ? Math.round((completed / total) * 100) : 0;

        // Отдаём страницу кабинета с данными
        res.render('cabinet', {
          user,
          lessons: availableLessons,
          courseName,
          progress
        });
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
