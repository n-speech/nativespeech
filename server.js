const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => console.log('✅ Подключено к базе данных PostgreSQL (Railway)'))
  .catch(err => {
    console.error('❌ Ошибка подключения к PostgreSQL:', err);
    process.exit(1);
  });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'секрет_сессии',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.get('/admin', requireLogin, (req, res) => {
  if (req.session.user.email !== 'info@native-speech.com') {
    return res.status(403).send('⛔ Доступ запрещён');
  }
  res.render('admin', { message: null });
});

app.post('/admin', requireLogin, async (req, res) => {
  if (req.session.user.email !== 'info@native-speech.com') {
    return res.status(403).send('⛔ Доступ запрещён');
  }

  const { name, user_email, lesson_id, grade, access, course_id, password } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [user_email]);
    const existingUser = userResult.rows[0];

    if (!existingUser) {
      if (!password) {
        return res.render('admin', { message: '❗ Укажите пароль для нового пользователя' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users (name, email, password, course_id) VALUES ($1, $2, $3, $4)',
        [name, user_email, hashedPassword, course_id || null]
      );
    } else if (course_id) {
      await pool.query('UPDATE users SET course_id = $1 WHERE email = $2', [course_id, user_email]);
    }

    const accessNum = access === '1' ? 1 : 0;
    await pool.query(`
      INSERT INTO user_lessons (user_email, lesson_id, grade, access)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(user_email, lesson_id)
      DO UPDATE SET grade = EXCLUDED.grade, access = EXCLUDED.access
    `, [user_email, lesson_id, grade, accessNum]);

    res.render('admin', { message: '✅ Данные успешно сохранены!' });
  } catch (error) {
    console.error('❌ Ошибка в POST /admin:', error);
    res.render('admin', { message: 'Произошла ошибка при сохранении.' });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.render('login', { error: 'Пользователь не найден' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Неверный пароль' });

    const accessResult = await pool.query('SELECT lesson_id FROM user_lessons WHERE user_email = $1 AND access = 1', [email]);
    const access = accessResult.rows.map(r => r.lesson_id);

    req.session.user = {
      email: user.email,
      name: user.name || '',
      course_id: user.course_id,
      access,
    };

    if (user.email === 'info@native-speech.com') {
      return res.redirect('/admin');
    } else {
      return res.redirect('/cabinet');
    }
  } catch (error) {
    console.error('Ошибка при логине:', error);
    res.render('login', { error: 'Произошла ошибка' });
  }
});

app.get('/cabinet', requireLogin, async (req, res) => {
  const user = req.session.user;
  try {
    const courseResult = await pool.query('SELECT title FROM courses WHERE id = $1', [user.course_id]);
    const courseName = courseResult.rows[0] ? courseResult.rows[0].title : 'Ваш курс';

    const lessonsResult = await pool.query('SELECT * FROM lessons WHERE course_id = $1', [user.course_id]);
    const lessons = lessonsResult.rows;

    const gradesResult = await pool.query('SELECT lesson_id, grade FROM user_lessons WHERE user_email = $1', [user.email]);
    const gradeMap = {};
    gradesResult.rows.forEach(g => gradeMap[g.lesson_id] = g.grade);

    const availableLessons = lessons.map(lesson => ({
      ...lesson,
      access: user.access.includes(lesson.id),
      grade: gradeMap[lesson.id] || null,
    }));

    const total = availableLessons.length;
    const completed = availableLessons.filter(l => l.grade).length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    res.render('cabinet', { user, lessons: availableLessons, courseName, progress });
  } catch (err) {
    console.error('❌ Ошибка загрузки данных кабинета:', err);
    res.send('❌ Ошибка загрузки данных');
  }
});

app.get('/lesson/:id', requireLogin, async (req, res) => {
  const lessonId = req.params.id;
  const user = req.session.user;
  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к уроку');
  }
  try {
    const result = await pool.query('SELECT * FROM lessons WHERE id = $1', [lessonId]);
    const lesson = result.rows[0];
    if (!lesson) return res.status(404).send('⛔ Урок не найден');

    const filePath = path.join(__dirname, 'lessons', lesson.file);
    if (!fs.existsSync(filePath)) return res.status(404).send('⛔ Файл урока не найден');

    res.sendFile(filePath);
  } catch (err) {
    console.error('Ошибка загрузки урока:', err);
    res.status(500).send('❌ Ошибка сервера');
  }
});

app.use('/lesson/:id/static', requireLogin, (req, res, next) => {
  const lessonId = req.params.id;
  const user = req.session.user;
  if (!user.access.includes(lessonId)) {
    return res.status(403).send('⛔ Нет доступа к файлам');
  }
  const staticPath = path.join(__dirname, 'lessons', lessonId);
  express.static(staticPath)(req, res, next);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/cabinet');
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`✅ Сервер запущен: http://localhost:${port}`);
});
