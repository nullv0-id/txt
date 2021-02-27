import express from 'express';
import sqlite3 from 'sqlite3';
import fs_ from 'fs';

const ID_LEN = Number(process.env.ID_LEN ?? 5);
const MAX_SIZE = process.env.MAX_SIZE ?? '400kb';
const PORT = Number(process.env.PORT ?? 1024);

const app = express();
app.use(express.raw({ limit: MAX_SIZE, type: () => true }));
app.use((req, res, next) => { res.setHeader('access-control-allow-origin', '*'); next(); });

const dbEmpty = !fs_.existsSync('db.db');
const db = new sqlite3.Database('db.db');

db.serialize(() => {
  if (dbEmpty) {
    db.run('CREATE TABLE posts (id TEXT PRIMARY KEY, content BLOB NOT NULL, mimetype TEXT NOT NULL, created INT NOT NULL)');
  }
});

function gen58(n) {
  let s = '';
  while (n--) {
    s += '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)];
  }
  return s;
}

async function invalid(id) {
  return new Promise((ret, err) => {
    db.serialize(() => {
      db.get('SELECT 1 FROM posts WHERE id = ?', id, (err_, row) => {
        if (row) { ret(true); } else { ret(false); }
      });
    });
  });
}
async function get(id) {
  return new Promise((ret, err) => {
    db.serialize(() => {
      db.get('SELECT content, mimetype FROM posts WHERE id = ?', id, (err_, row) => {
        if (row) { ret(row); } else { ret(null); }
      });
    });
  });
}

function url(req) {
  return 'https://' + req.get('host') + req.originalUrl;
}

app.get('/', (req, res) => {
  res.send('<!DOCTYPE html><html lang="en"><head><title>txt</title><style>body{background:#222;color:white;}</style></head><body><h1>how to use</h1><span>send a <code>POST</code> request here with your data in the body that\'s it</span><h2>terminal</h2><pre><code>echo text | curl -d@- txt.zerov0.id</code></pre><h2>add as command (bash)</h2><pre><code>echo alias pb=\\\'curl -d@- txt.zerov0.id\\\' >> .bashrc</code></pre></body></html>');
});

app.post('/', async (req, res) => {
  let id; do { id = gen58(ID_LEN); } while (await invalid(id));
  const body = req.body instanceof Buffer ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf-8');
  db.run('INSERT INTO posts VALUES (?, ?, ?, ?)', id, body, req.get('content-type') === 'application/x-www-form-urlencoded' ? 'text/plain' : req.get('content-type') ?? '', Number(new Date()));
  res.send(url(req) + id);
});

app.get('/:id', async (req, res) => {
  const post = await get(req.params.id);
  if (post) {
    const { content, mimetype } = post;
    res.setHeader('content-type', mimetype + '; charset=utf-8'); res.send(content);
  } else { res.status(404).send('File not found'); }
});

app.listen(PORT);
