const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const session = require('express-session');


const app = express();
app.use(session({
  secret: 'meowSecretKey', // 可改成任何你自訂的密鑰
  resave: false,
  saveUninitialized: false
}));

const PORT = 3000;

// 建立 /db 資料夾（如果不存在）
const dbFolder = path.join(__dirname, 'db');
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder);
}

// 資料庫檔案路徑
const dbPath = path.join(dbFolder, 'cat_volunteer.db');
console.log("📂 資料庫位置：", dbPath);

// 建立資料庫連線
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error('❌ 資料庫打不開：', err.message);
  }
  console.log('✅ 成功連線到 SQLite 資料庫');
});

// 建立資料表（如果不存在）
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT,
    phone TEXT,
    address TEXT,
    email TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  )`);

  db.run(`INSERT OR IGNORE INTO admin (id, username, password) VALUES (1, 'admin', '1234')`);

  db.run(`ALTER TABLE volunteers ADD COLUMN approved INTEGER DEFAULT 0`, err => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("⚠️ 新增欄位失敗：", err.message);
    } else {
      console.log("✅ 已加入 approved 欄位（或已存在）");
    }
  });
});

function requireLogin(req, res, next) {
  if (req.session.loggedIn) {
    next(); // 通過驗證
  } else {
    res.status(401).send('請先登入');
  }
}

app.use(express.json());

// 首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 登入
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (row) {
      req.session.loggedIn = true;
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });
});

// 志工申請
app.post('/register', (req, res) => {
  const { name, gender, phone, address, email } = req.body;
  db.run('INSERT INTO volunteers (name, gender, phone, address, email) VALUES (?, ?, ?, ?, ?)',
    [name, gender, phone, address, email],
    (err) => {
      if (err) return res.send('申請失敗');
      res.send('申請成功');
    });
});

// 顯示 admin.html 頁面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 志工資料
app.get('/api/volunteers',requireLogin, (req, res) => {
  db.all('SELECT * FROM volunteers', (err, rows) => {
    res.json(rows);
  });
});

// 取得未批准的志工
app.get('/api/volunteers/pending',requireLogin, (req, res) => {
  db.all('SELECT * FROM volunteers WHERE approved = 0', (err, rows) => {
    res.json(rows);
  });
});

// 取得已批准的志工
app.get('/api/volunteers/approved', requireLogin,(req, res) => {
  db.all('SELECT * FROM volunteers WHERE approved = 1', (err, rows) => {
    res.json(rows);
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 刪除志工資料
app.delete('/api/volunteers/:id',requireLogin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM volunteers WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 可選：批准志工
app.put('/api/volunteers/:id/approve',requireLogin, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE volunteers SET approved = 1 WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 伺服器啟動：http://localhost:${PORT}`);
});
