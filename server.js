const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 3000;

// Временная база
const db = require("./database.json");

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Доступ к аудиофайлам в lessons/audioL1
app.use("/audioL1", express.static(path.join(__dirname, "lessons/audioL1")));

app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: false
}));

function checkAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user) {
    return res.render("login", { error: "Неверный логин или пароль" });
  }
  const match = await bcrypt.compare(password, user.password);
  if (match) {
    req.session.user = user;
    res.redirect("/dashboard");
  } else {
    res.render("login", { error: "Неверный логин или пароль" });
  }
});

app.get("/dashboard", checkAuth, (req, res) => {
  const lessons = db.lessons.filter(l => req.session.user.access.includes(l.id));
  res.render("dashboard", { user: req.session.user, lessons });
});

app.get("/lesson/:id", checkAuth, (req, res) => {
  const { id } = req.params;
  const lesson = db.lessons.find(l => l.id === id);
  if (!lesson || !req.session.user.access.includes(id)) return res.sendStatus(403);

  const filePath = path.join(__dirname, "lessons", lesson.file);
  fs.readFile(filePath, "utf-8", (err, htmlContent) => {
    if (err) return res.sendStatus(500);
    res.render("lesson", { lesson, htmlContent });
  });
});

app.listen(PORT, () => console.log("Server started on port", PORT));
