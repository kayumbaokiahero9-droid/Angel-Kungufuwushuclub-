// server.js — Angels Kung Fu Wushu Club: full-stack club management app.
// Pure Node.js, zero npm dependencies. Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const store = require('./lib/store');
const auth = require('./lib/auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- tiny helpers ----------
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}
function memberVisibleTo(user, memberId) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'instructor') return true;
  if (user.role === 'member') return user.memberId === memberId;
  if (user.role === 'parent') return (user.linkedMemberIds || []).includes(memberId);
  return false;
}
function publicMember(db, m) {
  const belt = db.belts.find(b => b.order === m.beltOrder) || {};
  return { ...m, beltName: belt.name || 'Unranked', beltColor: belt.color || '#999' };
}
function publicUser(u) {
  const { passwordHash, passwordSalt, ...rest } = u;
  return rest;
}
function notFound(res) { sendJson(res, 404, { error: 'Not found' }); }
function forbidden(res) { sendJson(res, 403, { error: 'Forbidden' }); }
function unauthorized(res) { sendJson(res, 401, { error: 'Unauthorized' }); }
function badRequest(res, msg) { sendJson(res, 400, { error: msg || 'Bad request' }); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) return notFound(res);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback for client-side routes
      if (!path.extname(pathname)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        return notFound(res);
      }
    }
    const ext = path.extname(filePath);
    const isManifest = path.basename(filePath) === 'manifest.json';
    res.writeHead(200, { 'Content-Type': isManifest ? 'application/manifest+json' : (MIME[ext] || 'application/octet-stream') });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------- route handlers ----------
async function handleApi(req, res, parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean); // ['api', ...]
  const resource = segments[1];
  const id = segments[2];
  const sub = segments[3];
  const method = req.method;

  // ===== AUTH =====
  if (resource === 'auth') {
    if (segments[2] === 'login' && method === 'POST') {
      const body = await readBody(req);
      const db = store.load();
      const user = db.users.find(u => u.username.toLowerCase() === String(body.username || '').toLowerCase());
      if (!user || !user.active || !store.verifyPassword(body.password || '', user.passwordSalt, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Invalid username or password' });
      }
      const token = auth.issueSession(db, user.id);
      return sendJson(res, 200, { token, user: publicUser(user) });
    }
    if (segments[2] === 'logout' && method === 'POST') {
      const { db, token } = auth.requireAuth(req);
      if (token) auth.revokeSession(db, token);
      return sendJson(res, 200, { ok: true });
    }
    if (segments[2] === 'me' && method === 'GET') {
      const { user } = auth.requireAuth(req);
      if (!user) return unauthorized(res);
      return sendJson(res, 200, { user: publicUser(user) });
    }
    return notFound(res);
  }

  // ===== PUBLIC: club info, schedule, events, announcements (no auth needed) =====
  if (resource === 'club' && method === 'GET') {
    const db = store.load();
    return sendJson(res, 200, db.club);
  }
  if (resource === 'belts' && method === 'GET') {
    const db = store.load();
    return sendJson(res, 200, db.belts);
  }
  if (resource === 'apply' && method === 'POST') {
    const db = store.load();
    const body = await readBody(req);
    if (!body.name || !body.phone) return badRequest(res, 'Name and phone are required');
    const m = {
      id: store.uid('mem'), name: body.name, dob: body.dob || '', gender: body.gender || '',
      phone: body.phone, email: body.email || '', address: body.address || '',
      beltOrder: 1, joinDate: new Date().toISOString().slice(0, 10), status: 'pending',
      isInstructor: false, guardianUserIds: [], photoUrl: '', notes: body.notes || '(public application)'
    };
    db.members.push(m);
    store.save(db);
    return sendJson(res, 201, { ok: true, message: 'Application received. The club will contact you to confirm enrollment.' });
  }

  // Everything past this point requires a session
  const { db, user } = auth.requireAuth(req);
  if (!user) return unauthorized(res);

  // ===== DASHBOARD =====
  if (resource === 'dashboard' && method === 'GET') {
    if (user.role === 'member' || user.role === 'parent') {
      const myIds = user.role === 'member' ? [user.memberId] : (user.linkedMemberIds || []);
      const myMembers = db.members.filter(m => myIds.includes(m.id)).map(m => publicMember(db, m));
      const myPayments = db.payments.filter(p => myIds.includes(p.memberId));
      const myAttendance = db.attendance.filter(a => myIds.includes(a.memberId));
      const upcomingEvents = db.events.filter(e => e.date >= new Date().toISOString().slice(0, 10));
      return sendJson(res, 200, { members: myMembers, payments: myPayments, attendanceCount: myAttendance.length, upcomingEvents, announcements: db.announcements.slice(-5).reverse() });
    }
    // admin / instructor
    const activeMembers = db.members.filter(m => m.status === 'active');
    const totalCollected = db.payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount || 0), 0);
    const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentAttendance = db.attendance.filter(a => new Date(a.date).getTime() >= last30);
    const attendanceRate = recentAttendance.length ? Math.round(100 * recentAttendance.filter(a => a.status === 'present').length / recentAttendance.length) : null;
    const beltCounts = {};
    activeMembers.forEach(m => { const b = db.belts.find(x => x.order === m.beltOrder); const n = b ? b.name : 'Unranked'; beltCounts[n] = (beltCounts[n] || 0) + 1; });
    return sendJson(res, 200, {
      totalMembers: activeMembers.length,
      pendingApplications: db.members.filter(m => m.status === 'pending').length,
      totalInstructors: db.members.filter(m => m.isInstructor).length,
      totalCollected: (user.role === 'admin') ? totalCollected : undefined,
      attendanceRate30d: attendanceRate,
      beltCounts,
      upcomingEvents: db.events.filter(e => e.date >= new Date().toISOString().slice(0, 10)),
      recentAnnouncements: db.announcements.slice(-5).reverse()
    });
  }

  // ===== MEMBERS =====
  if (resource === 'members') {
    if (method === 'GET' && !id) {
      let list = db.members;
      if (user.role === 'member') list = list.filter(m => m.id === user.memberId);
      if (user.role === 'parent') list = list.filter(m => (user.linkedMemberIds || []).includes(m.id));
      return sendJson(res, 200, list.map(m => publicMember(db, m)));
    }
    if (method === 'GET' && id && !sub) {
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      if (!memberVisibleTo(user, m.id)) return forbidden(res);
      return sendJson(res, 200, publicMember(db, m));
    }
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req);
      if (!body.name) return badRequest(res, 'Name is required');
      const m = {
        id: store.uid('mem'), name: body.name, dob: body.dob || '', gender: body.gender || '',
        phone: body.phone || '', email: body.email || '', address: body.address || '',
        beltOrder: Number(body.beltOrder) || 1, joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
        status: body.status || 'active', isInstructor: !!body.isInstructor, guardianUserIds: [], photoUrl: '', notes: body.notes || ''
      };
      db.members.push(m); store.save(db);
      return sendJson(res, 201, publicMember(db, m));
    }
    if (method === 'PUT' && id && !sub) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      const body = await readBody(req);
      ['name', 'dob', 'gender', 'phone', 'email', 'address', 'status', 'notes', 'isInstructor'].forEach(k => {
        if (body[k] !== undefined) m[k] = body[k];
      });
      if (body.beltOrder !== undefined) m.beltOrder = Number(body.beltOrder);
      store.save(db);
      return sendJson(res, 200, publicMember(db, m));
    }
    if (method === 'DELETE' && id && !sub) {
      if (!auth.hasRole(user, ['admin'])) return forbidden(res);
      db.members = db.members.filter(x => x.id !== id);
      store.save(db);
      return sendJson(res, 200, { ok: true });
    }
    // approve pending application -> create login account
    if (method === 'POST' && id && sub === 'create-account') {
      if (!auth.hasRole(user, ['admin'])) return forbidden(res);
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      const body = await readBody(req);
      if (!body.username || !body.password) return badRequest(res, 'username and password required');
      if (db.users.find(u => u.username.toLowerCase() === body.username.toLowerCase())) return badRequest(res, 'Username already taken');
      const { salt, hash } = store.hashPassword(body.password);
      const role = body.role === 'parent' ? 'parent' : (body.role === 'instructor' ? 'instructor' : 'member');
      const newUser = {
        id: store.uid('usr'), username: body.username, role, name: m.name,
        passwordSalt: salt, passwordHash: hash,
        memberId: role === 'parent' ? null : m.id,
        linkedMemberIds: role === 'parent' ? [m.id] : [],
        createdAt: store.nowIso(), active: true
      };
      m.status = 'active';
      if (role === 'instructor') m.isInstructor = true;
      db.users.push(newUser);
      store.save(db);
      return sendJson(res, 201, publicUser(newUser));
    }
    // promotion history
    if (method === 'GET' && id && sub === 'promotions') {
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      if (!memberVisibleTo(user, m.id)) return forbidden(res);
      return sendJson(res, 200, db.promotions.filter(p => p.memberId === id));
    }
    if (method === 'POST' && id && sub === 'promote') {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      const body = await readBody(req);
      const toOrder = Number(body.toOrder);
      if (!toOrder || !db.belts.find(b => b.order === toOrder)) return badRequest(res, 'Invalid target belt');
      const promo = { id: store.uid('prm'), memberId: id, fromOrder: m.beltOrder, toOrder, date: body.date || new Date().toISOString().slice(0, 10), examiner: body.examiner || user.name, notes: body.notes || '' };
      db.promotions.push(promo);
      m.beltOrder = toOrder;
      store.save(db);
      return sendJson(res, 201, promo);
    }
    // attendance for one member
    if (method === 'GET' && id && sub === 'attendance') {
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      if (!memberVisibleTo(user, m.id)) return forbidden(res);
      return sendJson(res, 200, db.attendance.filter(a => a.memberId === id).sort((a, b) => b.date.localeCompare(a.date)));
    }
    // payments for one member
    if (method === 'GET' && id && sub === 'payments') {
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      if (!memberVisibleTo(user, m.id)) return forbidden(res);
      return sendJson(res, 200, db.payments.filter(p => p.memberId === id).sort((a, b) => b.date.localeCompare(a.date)));
    }
    // certificates for one member
    if (method === 'GET' && id && sub === 'certificates') {
      const m = db.members.find(x => x.id === id);
      if (!m) return notFound(res);
      if (!memberVisibleTo(user, m.id)) return forbidden(res);
      return sendJson(res, 200, db.certificates.filter(c => c.memberId === id));
    }
    return notFound(res);
  }

  // ===== CLASSES (recurring weekly schedule) =====
  if (resource === 'classes') {
    if (method === 'GET' && !id) return sendJson(res, 200, db.classes);
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req);
      const c = { id: store.uid('cls'), day: body.day, startTime: body.startTime, endTime: body.endTime, location: body.location || db.club.location, instructorId: body.instructorId || null, capacity: Number(body.capacity) || 30 };
      db.classes.push(c); store.save(db);
      return sendJson(res, 201, c);
    }
    if (method === 'PUT' && id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const c = db.classes.find(x => x.id === id);
      if (!c) return notFound(res);
      const body = await readBody(req);
      Object.assign(c, body);
      store.save(db);
      return sendJson(res, 200, c);
    }
    if (method === 'DELETE' && id) {
      if (!auth.hasRole(user, ['admin'])) return forbidden(res);
      db.classes = db.classes.filter(x => x.id !== id);
      store.save(db);
      return sendJson(res, 200, { ok: true });
    }
    return notFound(res);
  }

  // ===== ATTENDANCE =====
  if (resource === 'attendance') {
    if (method === 'GET' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const q = parsed.query || {};
      let list = db.attendance;
      if (q.date) list = list.filter(a => a.date === q.date);
      if (q.classId) list = list.filter(a => a.classId === q.classId);
      return sendJson(res, 200, list);
    }
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req); // { classId, date, records: [{memberId, status}] }
      if (!Array.isArray(body.records)) return badRequest(res, 'records array required');
      const created = [];
      body.records.forEach(r => {
        // upsert: one attendance row per member/class/date
        let existing = db.attendance.find(a => a.classId === body.classId && a.date === body.date && a.memberId === r.memberId);
        if (existing) { existing.status = r.status; created.push(existing); }
        else {
          const a = { id: store.uid('att'), classId: body.classId, date: body.date, memberId: r.memberId, status: r.status, recordedBy: user.id };
          db.attendance.push(a); created.push(a);
        }
      });
      store.save(db);
      return sendJson(res, 201, created);
    }
    return notFound(res);
  }

  // ===== PAYMENTS =====
  if (resource === 'payments') {
    if (method === 'GET' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      return sendJson(res, 200, db.payments.sort((a, b) => b.date.localeCompare(a.date)));
    }
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req);
      if (!body.memberId || !body.amount) return badRequest(res, 'memberId and amount required');
      const p = { id: store.uid('pay'), memberId: body.memberId, amount: Number(body.amount), currency: db.club.currency, method: body.method || 'Cash', period: body.period || '', date: body.date || new Date().toISOString().slice(0, 10), status: body.status || 'confirmed', recordedBy: user.id, reference: body.reference || '' };
      db.payments.push(p); store.save(db);
      return sendJson(res, 201, p);
    }
    return notFound(res);
  }

  // ===== EVENTS =====
  if (resource === 'events') {
    if (method === 'GET' && !id) return sendJson(res, 200, db.events.sort((a, b) => b.date.localeCompare(a.date)));
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req);
      const e = { id: store.uid('evt'), title: body.title, type: body.type || 'Event', level: body.level || 'Local', date: body.date, location: body.location || '', description: body.description || '', resultsSummary: body.resultsSummary || '', imageUrl: body.imageUrl || '' };
      db.events.push(e); store.save(db);
      return sendJson(res, 201, e);
    }
    if (method === 'PUT' && id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const e = db.events.find(x => x.id === id);
      if (!e) return notFound(res);
      Object.assign(e, await readBody(req));
      store.save(db);
      return sendJson(res, 200, e);
    }
    if (method === 'DELETE' && id) {
      if (!auth.hasRole(user, ['admin'])) return forbidden(res);
      db.events = db.events.filter(x => x.id !== id);
      store.save(db);
      return sendJson(res, 200, { ok: true });
    }
    return notFound(res);
  }

  // ===== CERTIFICATES =====
  if (resource === 'certificates') {
    if (method === 'GET' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      return sendJson(res, 200, db.certificates);
    }
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req);
      if (!body.memberId || !body.title) return badRequest(res, 'memberId and title required');
      const c = { id: store.uid('cert'), memberId: body.memberId, title: body.title, dateIssued: body.dateIssued || new Date().toISOString().slice(0, 10), eventId: body.eventId || null };
      db.certificates.push(c); store.save(db);
      return sendJson(res, 201, c);
    }
    return notFound(res);
  }

  // ===== ANNOUNCEMENTS =====
  if (resource === 'announcements') {
    if (method === 'GET' && !id) return sendJson(res, 200, db.announcements.sort((a, b) => b.date.localeCompare(a.date)));
    if (method === 'POST' && !id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      const body = await readBody(req);
      if (!body.title) return badRequest(res, 'title required');
      const a = { id: store.uid('ann'), title: body.title, body: body.body || '', date: store.nowIso(), audience: body.audience || 'all' };
      db.announcements.push(a); store.save(db);
      return sendJson(res, 201, a);
    }
    if (method === 'DELETE' && id) {
      if (!auth.hasRole(user, ['admin', 'instructor'])) return forbidden(res);
      db.announcements = db.announcements.filter(x => x.id !== id);
      store.save(db);
      return sendJson(res, 200, { ok: true });
    }
    return notFound(res);
  }

  // ===== USERS (admin only: manage accounts) =====
  if (resource === 'users') {
    if (!auth.hasRole(user, ['admin'])) return forbidden(res);
    if (method === 'GET' && !id) return sendJson(res, 200, db.users.map(publicUser));
    if (method === 'PUT' && id) {
      const u = db.users.find(x => x.id === id);
      if (!u) return notFound(res);
      const body = await readBody(req);
      if (body.active !== undefined) u.active = !!body.active;
      if (body.role) u.role = body.role;
      if (body.password) { const { salt, hash } = store.hashPassword(body.password); u.passwordSalt = salt; u.passwordHash = hash; }
      store.save(db);
      return sendJson(res, 200, publicUser(u));
    }
    return notFound(res);
  }

  return notFound(res);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }
  try {
    if (parsed.pathname.startsWith('/api/')) {
      await handleApi(req, res, parsed);
    } else {
      serveStatic(req, res, parsed.pathname);
    }
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error', detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🥋 Angels Kung Fu Wushu Club app running: http://localhost:${PORT}\n`);
  console.log('Seed logins:');
  console.log('  admin      / Admin@123   (Chief Instructor / Owner - full access)');
  console.log('  coach.jean / Coach@123   (Instructor)');
  console.log('  member.eric/ Member@123  (Member)');
  console.log('  parent.alice/Parent@123  (Parent)');
});
