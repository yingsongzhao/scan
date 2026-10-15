'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const scrypt = require('node:util').promisify(crypto.scrypt);
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/;
const SESSION_MS = 8 * 60 * 60 * 1000;
const LIMIT_MS = 15 * 60 * 1000;
const passwordOK = p => typeof p === 'string' && p.length >= 6 && p.length <= 128;
const publicUser = u => ({ username: u.username, role: u.role, disabled: u.disabled });
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: (await scrypt(password, salt, 64)).toString('hex') };
}
async function checkPassword(password, record) {
  const actual = await scrypt(password, record ? record.salt : '00000000000000000000000000000000', 64);
  return crypto.timingSafeEqual(actual, record ? Buffer.from(record.hash, 'hex') : Buffer.alloc(64));
}
async function atomicWrite(filename, text, exclusive = false) {
  const tmp = filename + '.' + crypto.randomBytes(12).toString('hex') + '.tmp';
  let file;
  try {
    file = await fs.open(tmp, 'wx', 0o600);
    await file.chmod(0o600); await file.writeFile(text, 'utf8'); await file.sync();
    await file.close(); file = null;
    if (exclusive) { await fs.link(tmp, filename); await fs.unlink(tmp); }
    else await fs.rename(tmp, filename);
    await fs.chmod(filename, 0o600);
  } catch (error) {
    if (file) await file.close().catch(() => {});
    await fs.unlink(tmp).catch(() => {}); throw error;
  }
}
async function bootstrap(dataFile, username) {
  if (typeof dataFile !== 'string' || !dataFile || typeof username !== 'string' || !USERNAME.test(username)) throw new Error('无效的数据文件或账号（3-32位）');
  const password = crypto.randomBytes(24).toString('base64url');
  await atomicWrite(path.resolve(dataFile), JSON.stringify({ version: 1, users: [{ username, role: 'admin', disabled: false, ...await hashPassword(password) }] }, null, 2) + '\n', true);
  return { username, password };
}
function validateDB(db) {
  if (!db || db.version !== 1 || !Array.isArray(db.users) || !db.users.length) throw new Error('无效的账号数据库');
  const names = new Set();
  for (const u of db.users) {
    if (!u || typeof u.username !== 'string' || !USERNAME.test(u.username) || names.has(u.username) || !['admin', 'user'].includes(u.role) || typeof u.disabled !== 'boolean' || !/^[a-f0-9]{32}$/.test(u.salt) || !/^[a-f0-9]{128}$/.test(u.hash)) throw new Error('无效的账号数据库');
    names.add(u.username);
  }
  if (!db.users.some(u => u.role === 'admin' && !u.disabled)) throw new Error('必须有启用的管理员');
  return db;
}
const STYLE = 'body{font-family:system-ui,sans-serif;background:#f3f5f9;color:#182535;margin:0;padding:28px}main{max-width:850px;margin:30px auto;background:white;padding:28px;border-radius:14px}label{display:block;margin:14px 0}input,select,button{font:inherit;padding:9px;margin:4px;border:1px solid #bdc6d2;border-radius:6px}button{cursor:pointer;background:#1467cf;color:white}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}#message{white-space:pre-wrap;color:#a12222}';
function page(title, body, script) {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>' + STYLE + '</style></head><body><main>' + body + '</main><script>' + script + '</script></body></html>';
}
const LOGIN_HTML = page('登录', '<h1>账号登录</h1><p>请使用管理员分配的账号，本系统不开放注册。</p><form id="login"><label>账号<input id="username" autocomplete="username" required maxlength="32"></label><label>密码<input id="password" type="password" autocomplete="current-password" required minlength="6" maxlength="128"></label><button>登录</button></form><p id="message" role="alert"></p>', `document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const m=document.getElementById('message');try{const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('username').value,password:document.getElementById('password').value})});const d=await r.json();if(r.ok)location.assign('/');else m.textContent=d.error||'登录失败';}catch{m.textContent='网络错误，请重试';}});`);
const ADMIN_HTML = page('账号管理', '<h1>账号管理</h1><a href="/">返回首页</a> <button id="logout">退出登录</button><h2>创建账号</h2><form id="create"><input id="username" placeholder="账号，3-32 位" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}" autocomplete="off"><input id="password" type="password" placeholder="密码，6-128 位" required minlength="6" maxlength="128" autocomplete="new-password"><select id="role"><option value="user">普通账号</option><option value="admin">管理员</option></select><button>创建</button></form><p id="message" role="alert"></p><h2>现有账号</h2><table><thead><tr><th>账号</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody id="users"></tbody></table>', `const el=id=>document.getElementById(id);async function api(url,body){const r=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'操作失败');return d;}async function run(fn){el('message').textContent='';try{await fn();}catch(e){el('message').textContent=e.message;}}async function load(){const d=await api('/auth/users');el('users').replaceChildren();for(const u of d.users){const tr=document.createElement('tr');for(const value of [u.username,u.role==='admin'?'管理员':'普通账号',u.disabled?'已禁用':'启用']){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td');const disable=document.createElement('button');disable.textContent=u.disabled?'启用':'禁用';disable.onclick=()=>run(async()=>{await api('/auth/users',{action:'disable',username:u.username,disabled:!u.disabled});await load();});const reset=document.createElement('button');reset.textContent='重设密码';reset.onclick=()=>run(async()=>{const password=prompt('请输入新密码（6-128 位）');if(password===null)return;await api('/auth/users',{action:'resetPassword',username:u.username,password});el('message').textContent='密码已重设，旧会话已失效。';});td.append(disable,reset);tr.append(td);el('users').append(tr);}}el('create').onsubmit=e=>{e.preventDefault();run(async()=>{await api('/auth/users',{action:'create',username:el('username').value,password:el('password').value,role:el('role').value});el('create').reset();await load();});};el('logout').onclick=()=>run(async()=>{await api('/auth/logout',{});location.assign('/login');});run(load);`);
function createAuth({ dataFile, secure = true, origin } = {}) {
  if (typeof dataFile !== 'string' || !dataFile) throw new TypeError('dataFile 必填');
  let allowedOrigin;
  try { const u = new URL(origin); if (!['http:', 'https:'].includes(u.protocol) || u.origin !== origin) throw Error(); allowedOrigin = u.origin; }
  catch { throw new TypeError('origin 必须是无路径的 http(s) 来源，例如 https://example.com'); }
  const filename = path.resolve(dataFile);
  let db;
  const ready = fs.readFile(filename, 'utf8').then(text => { db = validateDB(JSON.parse(text)); });
  ready.catch(() => {});
  let queue = Promise.resolve();
  const serial = fn => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };
  const sessions = new Map(), attempts = new Map();
  let globalStart = Date.now(), globalCount = 0;
  const cookieName = secure ? '__Host-scan_auth' : 'scan_auth';
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const revoke = username => { for (const [key, s] of sessions) if (s.username === username) sessions.delete(key); };
  function session(req) {
    const raw = String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(cookieName + '='));
    if (raw.length !== 1) return null;
    const token = raw[0].slice(cookieName.length + 1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const key = digest(token), s = sessions.get(key);
    if (!s) return null;
    const user = db.users.find(u => u.username === s.username);
    if (s.expires <= Date.now() || !user || user.disabled) { sessions.delete(key); return null; }
    return { key, user };
  }
  function rateAllowed(req) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    if (now - globalStart >= LIMIT_MS) { globalStart = now; globalCount = 0; }
    if (++globalCount > 2000) return false;
    const peer=req.socket?.remoteAddress||'unknown';
    const key=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)&&typeof req.headers['x-real-ip']==='string'?req.headers['x-real-ip'].slice(0,64):peer;
    let bucket = attempts.get(key);
    if (!bucket) { if (attempts.size >= 2048) return false; attempts.set(key, bucket = { count: 0, until: now + LIMIT_MS }); }
    return ++bucket.count <= 10;
  }
  async function readJSON(req) {
    let bytes = 0, tooLarge = false, chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 16384) { tooLarge = true; chunks = []; } else if (!tooLarge) chunks.push(chunk); }
    if (tooLarge) throw Object.assign(Error('请求体过大'), { status: 413 });
    try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value; }
    catch { throw Object.assign(Error('请求必须是 JSON 对象'), { status: 400 }); }
  }
  async function save(users) {
    const next = { version: 1, users };
    await atomicWrite(filename, JSON.stringify(next, null, 2) + '\n'); db = next;
  }
  return async function handle(req, res, route) {
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); return true; };
    const html = text => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", 'Referrer-Policy': 'no-referrer' }); res.end(text); return true; };
    try {
      await ready;
      const pathname = new URL(typeof route === 'string' ? route : route?.pathname || req.url, 'http://localhost').pathname;
      const method = req.method || 'GET';
      const isAPI = /^\/(?:api|auth)(?:\/|$)/.test(pathname) || String(req.headers.accept || '').includes('application/json');
      const current = session(req);
      req.auth = req.user = current ? publicUser(current.user) : null;
      if (method === 'GET' && pathname === '/login') return html(LOGIN_HTML);
      if (method === 'POST' && pathname === '/auth/login') {
        if (req.headers.origin !== allowedOrigin) return json(403, { error: '来源校验失败' });
        if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] || '')) return json(415, { error: '仅接受 application/json' });
        if (!rateAllowed(req)) { res.setHeader('Retry-After', '900'); return json(429, { error: '登录失败，请稍后重试' }); }
        const body = await readJSON(req);
        const validInput = typeof body.username === 'string' && USERNAME.test(body.username) && passwordOK(body.password);
        const candidate = validInput ? db.users.find(u => u.username === body.username) : null;
        const correct = await checkPassword(validInput ? body.password : 'invalid-password', candidate);
        if (!correct || !candidate || candidate.disabled || db.users.find(u => u.username === candidate.username) !== candidate) return json(401, { error: '账号或密码错误' });
        const now = Date.now();
        for (const [key, s] of sessions) if (s.expires <= now) sessions.delete(key);
        if (sessions.size >= 10000) sessions.delete(sessions.keys().next().value);
        if (current) sessions.delete(current.key);
        const token = crypto.randomBytes(32).toString('base64url');
        sessions.set(digest(token), { username: candidate.username, expires: now + SESSION_MS });
        res.setHeader('Set-Cookie', cookie(token, SESSION_MS / 1000));
        return json(200, { user: publicUser(candidate) });
      }
      if (!current) {
        if (isAPI || !['GET', 'HEAD'].includes(method)) return json(401, { error: '请先登录' });
        res.writeHead(302, { Location: '/login', 'Cache-Control': 'no-store' }); res.end(); return true;
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        if (req.headers.origin !== allowedOrigin) return json(403, { error: '来源校验失败' });
        if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] || '')) return json(415, { error: '仅接受 application/json' });
      }
      if (pathname === '/auth/me' && method === 'GET') return json(200, { user: publicUser(current.user) });
      if (pathname === '/auth/logout' && method === 'POST') {
        await readJSON(req); sessions.delete(current.key); res.setHeader('Set-Cookie', cookie('', 0)); return json(200, { ok: true });
      }
      if (pathname === '/admin' || pathname === '/auth/users') {
        if (current.user.role !== 'admin') return json(403, { error: '仅管理员可访问' });
        if (pathname === '/admin' && method === 'GET') return html(ADMIN_HTML);
        if (pathname === '/auth/users' && method === 'GET') return json(200, { users: db.users.map(publicUser) });
        if (pathname === '/auth/users' && method === 'POST') {
          const body = await readJSON(req);
          return await serial(async () => {
            const active = session(req);
            if (!active || active.user.role !== 'admin') return json(403, { error: '管理员会话已失效' });
            if (typeof body.username !== 'string' || !USERNAME.test(body.username)) return json(400, { error: '账号需为3-32位字母、数字、点、下划线或短横线，首位为字母或数字' });
            const users = db.users.map(u => ({ ...u }));
            const target = users.find(u => u.username === body.username);
            if (body.action === 'create') {
              if (target) return json(409, { error: '账号已存在' });
              if (!passwordOK(body.password) || !['user', 'admin'].includes(body.role || 'user')) return json(400, { error: '密码需6-128位，角色需为user或admin' });
              users.push({ username: body.username, role: body.role || 'user', disabled: false, ...await hashPassword(body.password) });
            } else if (body.action === 'disable') {
              if (!target) return json(404, { error: '账号不存在' });
              if (typeof body.disabled !== 'boolean') return json(400, { error: 'disabled 必须为布尔值' });
              if (body.disabled && target.role === 'admin' && !target.disabled && users.filter(u => u.role === 'admin' && !u.disabled).length <= 1) return json(409, { error: '不能禁用最后一个管理员' });
              target.disabled = body.disabled;
            } else if (body.action === 'resetPassword') {
              if (!target) return json(404, { error: '账号不存在' });
              if (!passwordOK(body.password)) return json(400, { error: '密码需6-128位' });
              Object.assign(target, await hashPassword(body.password));
            } else return json(400, { error: '未知操作' });
            await save(users);
            if (body.action !== 'create') revoke(body.username);
            return json(body.action === 'create' ? 201 : 200, { ok: true, user: publicUser(users.find(u => u.username === body.username)) });
          });
        }
        res.setHeader('Allow', pathname === '/admin' ? 'GET' : 'GET, POST');
        return json(405, { error: '请求方法不支持' });
      }
      if (pathname === '/login' || /^\/auth(?:\/|$)/.test(pathname)) return json(404, { error: '接口不存在' });
      return false;
    } catch (error) {
      if (res.headersSent) { res.end(); return true; }
      return json(error.status || 500, { error: error.status ? error.message : '认证服务暂不可用' });
    }
  };
}
module.exports = { createAuth, bootstrap };
if (require.main === module) {
  (async () => {
    const [, , command, dataFile, username, ...extra] = process.argv;
    if (command !== 'init' || !dataFile || !username || extra.length) throw new Error('用法：node auth.cjs init <dataFile> <username>');
    const credentials = await bootstrap(dataFile, username);
    await atomicWrite(path.resolve(dataFile) + '.initial.txt', `账号：${credentials.username}\n初始密码：${credentials.password}\n请妥善保存，首次登录后重设密码并删除本文件。\n`, true);
    process.stdout.write('初始化完成，初始凭据已写入受限权限文件。\n');
  })().catch(error => { process.stderr.write('初始化失败：' + (error.code || error.message) + '\n'); process.exitCode = 1; });
}
