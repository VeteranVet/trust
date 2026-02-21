const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return {}; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + 'tb_secret_salt_2025').digest('hex');
}
function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ ok: false, err: 'Not logged in.' });
  const users = readUsers();
  const user  = Object.values(users).find(u => u.token === token);
  if (!user)  return res.status(401).json({ ok: false, err: 'Session expired. Please sign in again.' });
  req.user = user;
  next();
}

app.post('/api/register', (req, res) => {
  let { username, password } = req.body || {};
  if (!username || !password) return res.json({ ok: false, err: 'Both fields are required.' });
  username = username.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.json({ ok: false, err: 'Username must be 3-20 characters (letters, numbers, underscores only).' });
  if (password.length < 6)
    return res.json({ ok: false, err: 'Password must be at least 6 characters.' });
  const users = readUsers();
  if (Object.values(users).some(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.json({ ok: false, err: 'Username already taken.' });
  const id = 'u_' + Date.now();
  const token = makeToken();
  users[id] = { id, username, password: hashPassword(password), token, createdAt: Date.now(), transactions: [] };
  writeUsers(users);
  res.json({ ok: true, user: { id, username }, token });
});

app.post('/api/login', (req, res) => {
  let { username, password } = req.body || {};
  if (!username || !password) return res.json({ ok: false, err: 'Please enter your credentials.' });
  username = username.trim().toLowerCase();
  const users = readUsers();
  const found = Object.values(users).find(
    u => u.username.toLowerCase() === username && u.password === hashPassword(password)
  );
  if (!found) return res.json({ ok: false, err: 'Incorrect username or password.' });
  const token = makeToken();
  users[found.id].token = token;
  writeUsers(users);
  res.json({ ok: true, user: { id: found.id, username: found.username }, token });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const users = readUsers();
  if (users[req.user.id]) { users[req.user.id].token = null; writeUsers(users); }
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: { id: req.user.id, username: req.user.username } });
});

app.get('/api/check-username', (req, res) => {
  const u = (req.query.username || '').trim().toLowerCase();
  if (!u) return res.json({ available: false });
  const users = readUsers();
  res.json({ available: !Object.values(users).some(x => x.username.toLowerCase() === u) });
});

app.get('/api/transactions', requireAuth, (req, res) => {
  const users = readUsers();
  res.json({ ok: true, transactions: users[req.user.id]?.transactions || [] });
});

app.post('/api/transactions', requireAuth, (req, res) => {
  const { txId, txData } = req.body || {};
  if (!txId) return res.json({ ok: false, err: 'txId required.' });
  const users = readUsers();
  if (!users[req.user.id]) return res.json({ ok: false, err: 'User not found.' });
  if (!users[req.user.id].transactions) users[req.user.id].transactions = [];
  const txs = users[req.user.id].transactions;
  const idx = txs.findIndex(t => t.id === txId);
  const record = { id: txId, ...txData, updatedAt: Date.now() };
  if (idx >= 0) txs[idx] = record; else txs.push(record);
  writeUsers(users);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log('TrustBridge running on port ' + PORT));
