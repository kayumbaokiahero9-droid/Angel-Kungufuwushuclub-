// app.js — Angels Kung Fu Wushu Club SPA. Vanilla JS, no build step, no framework.
const API = '/api';
let STATE = {
  token: localStorage.getItem('akfwc_token') || null,
  user: JSON.parse(localStorage.getItem('akfwc_user') || 'null'),
  club: null,
  belts: [],
};

// ---------- API helper ----------
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (STATE.token) headers['Authorization'] = 'Bearer ' + STATE.token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error(data.error || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- toast ----------
function toast(msg, isError = false) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- auth ----------
function setSession(token, user) {
  STATE.token = token; STATE.user = user;
  if (token) { localStorage.setItem('akfwc_token', token); localStorage.setItem('akfwc_user', JSON.stringify(user)); }
  else { localStorage.removeItem('akfwc_token'); localStorage.removeItem('akfwc_user'); }
}
async function doLogin(username, password) {
  const data = await api('/auth/login', { method: 'POST', body: { username, password } });
  setSession(data.token, data.user);
  toast('Welcome back, ' + data.user.name + '!');
  location.hash = '#/dashboard';
}
async function doLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
  setSession(null, null);
  location.hash = '#/';
}

// ---------- utils ----------
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(n, cur) { return Number(n || 0).toLocaleString() + ' ' + (cur || 'RWF'); }
function fmtDate(d) { if (!d) return '—'; return String(d).slice(0, 10); }
function beltChip(name, color) {
  return `<span class="belt-chip"><span class="belt-dot" style="background:${color || '#999'}"></span>${esc(name || 'Unranked')}</span>`;
}
function closeModal() { const m = document.querySelector('.modal-backdrop'); if (m) m.remove(); }
function openModal(innerHtml) {
  closeModal();
  const backdrop = el(`<div class="modal-backdrop"><div class="modal-box">${innerHtml}</div></div>`);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  return backdrop;
}

// ---------- shell / nav ----------
const NAV_BY_ROLE = {
  admin: [
    ['dashboard', 'Dashboard'], ['members', 'Members'], ['classes', 'Classes'],
    ['attendance', 'Attendance'], ['payments', 'Payments'], ['events', 'Events'],
    ['certificates', 'Certificates'], ['announcements', 'Announcements'], ['users', 'Accounts']
  ],
  instructor: [
    ['dashboard', 'Dashboard'], ['members', 'Members'], ['classes', 'Classes'],
    ['attendance', 'Attendance'], ['events', 'Events'], ['certificates', 'Certificates'],
    ['announcements', 'Announcements']
  ],
  member: [
    ['dashboard', 'My Dashboard'], ['classes', 'Schedule'], ['events', 'Events'], ['announcements', 'News']
  ],
  parent: [
    ['dashboard', 'My Dashboard'], ['classes', 'Schedule'], ['events', 'Events'], ['announcements', 'News']
  ],
};

function renderShell(activeRoute, contentHtml) {
  const app = document.getElementById('app');
  const isAuthed = !!STATE.user;
  const nav = isAuthed ? (NAV_BY_ROLE[STATE.user.role] || []) : [];
  app.innerHTML = `
    <header class="border-b border-[#222] sticky top-0 z-40" style="background:rgba(11,11,11,0.92);backdrop-filter:blur(6px)">
      <div class="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <a href="#/" class="flex items-center gap-3">
          <img src="/assets/badge.jpg" class="w-10 h-10 rounded-full object-cover border-2" style="border-color:var(--gold)"/>
          <div class="leading-tight">
            <div class="font-display text-xl gold-grad">ANGELS KUNG FU WUSHU CLUB</div>
            <div class="text-[10px] text-gray-400 tracking-widest">DISCIPLINE • STRENGTH • RESPECT • EXCELLENCE</div>
          </div>
        </a>
        <nav class="hidden md:flex items-center gap-5 text-sm">
          ${nav.map(([r, label]) => `<span class="nav-link ${activeRoute === r ? 'active' : ''}" onclick="location.hash='#/${r}'">${label}</span>`).join('')}
          ${isAuthed
            ? `<span class="text-gray-400">Hi, ${esc(STATE.user.name)}</span><button class="btn-outline px-3 py-1.5 rounded-lg text-xs" onclick="doLogout()">Logout</button>`
            : `<button class="btn-gold px-4 py-1.5 rounded-lg text-xs" onclick="location.hash='#/login'">Member Login</button>`
          }
        </nav>
        <button class="md:hidden text-gold-text" onclick="toggleMobileNav()">☰</button>
      </div>
      <div id="mobile-nav" class="hidden md:hidden border-t border-[#222] px-4 py-2 flex flex-col gap-2 text-sm">
        ${nav.map(([r, label]) => `<span class="nav-link ${activeRoute === r ? 'active' : ''}" onclick="location.hash='#/${r}';toggleMobileNav()">${label}</span>`).join('')}
        ${isAuthed
          ? `<button class="btn-outline px-3 py-1.5 rounded-lg text-xs w-fit" onclick="doLogout()">Logout</button>`
          : `<button class="btn-gold px-4 py-1.5 rounded-lg text-xs w-fit" onclick="location.hash='#/login'">Member Login</button>`
        }
      </div>
    </header>
    <main class="max-w-6xl mx-auto px-4 py-6">${contentHtml}</main>
    <footer class="border-t border-[#222] mt-16 py-8 text-center text-xs text-gray-500">
      <div>Angels Kung Fu Wushu Club — Kimihurura, Murugando (beside ADEPR) — 0783203747 / 0788207031</div>
      <div class="mt-1">Train Hard. Fight Smart. Be an Angel.</div>
    </footer>
  `;
}
function toggleMobileNav() { document.getElementById('mobile-nav').classList.toggle('hidden'); }

// ---------- router ----------
const ROUTES = {};
function route(path, handler) { ROUTES[path] = handler; }

async function router() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  const base = '/' + (parts[0] || '');
  const param = parts[1];

  // guard: private routes require auth
  const PUBLIC_ROUTES = ['/', '/login', '/apply'];
  if (!PUBLIC_ROUTES.includes(base) && !STATE.user) {
    location.hash = '#/login';
    return;
  }
  try {
    if (ROUTES[base]) return await ROUTES[base](param);
    return await ROUTES['/'](param);
  } catch (e) {
    if (e.status === 401) { setSession(null, null); location.hash = '#/login'; return; }
    renderShell(base.slice(1), `<div class="card p-8 text-center text-red-400">Error: ${esc(e.message)}</div>`);
  }
}
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const [club, belts] = await Promise.all([api('/club'), api('/belts')]);
    STATE.club = club; STATE.belts = belts;
  } catch (e) { console.error(e); }
  router();
});

// ============================================================
// PUBLIC LANDING PAGE
// ============================================================
route('/', async () => {
  const club = STATE.club || {};
  let classes = [];
  try { classes = await api('/classes'); } catch (e) {}
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  classes.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  renderShell('', `
    <section class="hero-bg rounded-2xl p-8 md:p-14 text-center border border-[#222] -mt-2">
      <img src="/assets/logo.jpg" class="w-28 h-28 md:w-36 md:h-36 mx-auto rounded-full object-cover border-4 mb-4" style="border-color:var(--gold)"/>
      <h1 class="font-display text-4xl md:text-6xl gold-grad">${esc(club.name || 'Angels Kung Fu Wushu Club')}</h1>
      <p class="mt-2 text-gray-300 tracking-widest text-sm md:text-base">${esc(club.tagline || '')}</p>
      <p class="mt-4 text-gray-400 max-w-2xl mx-auto">${esc(club.about || '')}</p>
      <div class="mt-6 flex flex-wrap gap-3 justify-center">
        <button class="btn-gold px-6 py-3 rounded-xl" onclick="location.hash='#/apply'">Join the Club</button>
        <button class="btn-outline px-6 py-3 rounded-xl" onclick="location.hash='#/login'">Member / Parent Login</button>
      </div>
      <p class="mt-6 font-display text-xl gold-text">${esc(club.motto || '')}</p>
    </section>

    <section class="mt-10 grid md:grid-cols-2 gap-6">
      <div class="card p-6">
        <h2 class="font-display text-2xl gold-text mb-3">Gahunda y'Imyitozo — Training Schedule</h2>
        <table class="data-table">
          <thead><tr><th>Day</th><th>Time</th><th>Location</th></tr></thead>
          <tbody>
            ${classes.map(c => `<tr><td>${esc(c.day)}</td><td>${esc(c.startTime)} – ${esc(c.endTime)}</td><td>${esc(c.location)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-gray-500">Schedule coming soon.</td></tr>'}
          </tbody>
        </table>
        <p class="mt-3 text-sm text-gray-400">📍 ${esc(club.location || '')}</p>
        ${club.weeklyHours ? `<p class="text-sm text-gray-400">⏱ ${esc(club.weeklyHours)} hours of training per week</p>` : ''}
      </div>
      <div class="card p-6">
        <h2 class="font-display text-2xl gold-text mb-3">Contact & Follow Us</h2>
        <p class="text-gray-300">📞 ${(club.phones || []).join(' / ')}</p>
        <p class="text-gray-300">📘 Facebook: ${esc(club.facebook || '')}</p>
        <p class="mt-3 text-gray-400 text-sm">Want to enroll your child or yourself? Submit an application and our team will contact you to confirm your first class.</p>
        <button class="btn-red px-5 py-2.5 rounded-xl mt-3" onclick="location.hash='#/apply'">Apply to Join →</button>
      </div>
    </section>

    <section class="mt-10">
      <h2 class="font-display text-2xl gold-text mb-3 text-center">Belt / Sash Ranking System</h2>
      <div class="flex flex-wrap gap-2 justify-center">
        ${(STATE.belts || []).map(b => beltChip(b.name, b.color)).join('')}
      </div>
    </section>

    <section class="mt-10">
      <h2 class="font-display text-2xl gold-text mb-3 text-center">Life at the Club</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        ${(club.galleryUrls || []).map(u => `<img src="${u}" class="rounded-xl object-cover w-full h-40 md:h-52 border border-[#222]"/>`).join('')}
      </div>
    </section>
  `);
});

route('/apply', async () => {
  renderShell('apply', `
    <div class="max-w-lg mx-auto card p-6">
      <h1 class="font-display text-3xl gold-text mb-1">Join Angels Kung Fu Wushu Club</h1>
      <p class="text-gray-400 text-sm mb-5">Tell us a bit about the trainee. Our team will contact you to confirm enrollment and first class.</p>
      <form id="apply-form" class="space-y-3">
        <div><label>Full Name *</label><input required name="name"/></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label>Date of Birth</label><input type="date" name="dob"/></div>
          <div><label>Gender</label><select name="gender"><option value="">—</option><option>M</option><option>F</option></select></div>
        </div>
        <div><label>Phone *</label><input required name="phone" placeholder="07XXXXXXXX"/></div>
        <div><label>Email</label><input type="email" name="email"/></div>
        <div><label>Address</label><input name="address"/></div>
        <div><label>Notes (parent name if a child, health notes, etc.)</label><textarea name="notes" rows="3"></textarea></div>
        <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Submit Application</button>
      </form>
    </div>
  `);
  document.getElementById('apply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api('/apply', { method: 'POST', body });
      toast('Application submitted! We will contact you soon.');
      e.target.reset();
    } catch (err) { toast(err.message, true); }
  });
});

route('/login', async () => {
  renderShell('login', `
    <div class="max-w-sm mx-auto card p-6 mt-8">
      <h1 class="font-display text-3xl gold-text mb-1 text-center">Member Login</h1>
      <p class="text-gray-400 text-sm mb-5 text-center">For members, parents, instructors & staff.</p>
      <form id="login-form" class="space-y-3">
        <div><label>Username</label><input required name="username" autocomplete="username"/></div>
        <div><label>Password</label><input required type="password" name="password" autocomplete="current-password"/></div>
        <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Log In</button>
      </form>
      <div class="mt-4 text-xs text-gray-500 leading-relaxed">
        <div class="font-semibold text-gray-400 mb-1">Demo accounts:</div>
        admin / Admin@123 — Chief Instructor (Owner)<br/>
        coach.jean / Coach@123 — Instructor<br/>
        member.eric / Member@123 — Member<br/>
        parent.alice / Parent@123 — Parent
      </div>
    </div>
  `);
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { await doLogin(fd.get('username'), fd.get('password')); }
    catch (err) { toast(err.message, true); }
  });
});

// ============================================================
// DASHBOARD
// ============================================================
route('/dashboard', async () => {
  const d = await api('/dashboard');
  const role = STATE.user.role;
  let body = '';
  if (role === 'admin' || role === 'instructor') {
    body = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-card"><div class="stat-num">${d.totalMembers}</div><div class="text-xs text-gray-400">Active Members</div></div>
        <div class="stat-card"><div class="stat-num">${d.pendingApplications}</div><div class="text-xs text-gray-400">Pending Applications</div></div>
        <div class="stat-card"><div class="stat-num">${d.totalInstructors}</div><div class="text-xs text-gray-400">Instructors</div></div>
        ${role === 'admin' ? `<div class="stat-card"><div class="stat-num">${money(d.totalCollected, STATE.club.currency)}</div><div class="text-xs text-gray-400">Total Collected</div></div>` :
          `<div class="stat-card"><div class="stat-num">${d.attendanceRate30d != null ? d.attendanceRate30d + '%' : '—'}</div><div class="text-xs text-gray-400">Attendance (30d)</div></div>`}
      </div>
      <div class="grid md:grid-cols-2 gap-6 mt-6">
        <div class="card p-5">
          <h3 class="font-display text-xl gold-text mb-3">Belt Distribution</h3>
          ${Object.entries(d.beltCounts || {}).map(([name, count]) => `
            <div class="flex justify-between text-sm py-1 border-b border-[#222]"><span>${esc(name)}</span><span class="text-gray-400">${count}</span></div>
          `).join('') || '<p class="text-gray-500 text-sm">No members yet.</p>'}
        </div>
        <div class="card p-5">
          <h3 class="font-display text-xl gold-text mb-3">Upcoming Events</h3>
          ${(d.upcomingEvents || []).map(e => `<div class="py-2 border-b border-[#222]"><div class="font-semibold">${esc(e.title)}</div><div class="text-xs text-gray-400">${fmtDate(e.date)} · ${esc(e.level)}</div></div>`).join('') || '<p class="text-gray-500 text-sm">No upcoming events.</p>'}
          <h3 class="font-display text-xl gold-text mb-3 mt-5">Recent Announcements</h3>
          ${(d.recentAnnouncements || []).map(a => `<div class="py-2 border-b border-[#222]"><div class="font-semibold">${esc(a.title)}</div><div class="text-xs text-gray-400">${fmtDate(a.date)}</div></div>`).join('') || '<p class="text-gray-500 text-sm">Nothing yet.</p>'}
        </div>
      </div>
      <div class="mt-6 flex flex-wrap gap-3">
        <button class="btn-gold px-4 py-2 rounded-lg" onclick="location.hash='#/members'">Manage Members</button>
        <button class="btn-outline px-4 py-2 rounded-lg" onclick="location.hash='#/attendance'">Mark Attendance</button>
        ${role === 'admin' ? `<button class="btn-outline px-4 py-2 rounded-lg" onclick="location.hash='#/payments'">Record Payment</button>` : ''}
      </div>
    `;
  } else {
    // member / parent
    body = `
      <div class="grid md:grid-cols-2 gap-6">
        ${(d.members || []).map(m => `
          <div class="card p-5">
            <div class="flex items-center justify-between">
              <h3 class="font-display text-2xl">${esc(m.name)}</h3>
              ${beltChip(m.beltName, m.beltColor)}
            </div>
            <p class="text-xs text-gray-500 mt-1">Member since ${fmtDate(m.joinDate)}</p>
            <div class="mt-3 flex gap-2 flex-wrap">
              <button class="btn-outline px-3 py-1.5 rounded-lg text-xs" onclick="viewMemberProfile('${m.id}')">View Profile</button>
              <button class="btn-outline px-3 py-1.5 rounded-lg text-xs" onclick="viewMemberAttendance('${m.id}')">Attendance</button>
              <button class="btn-outline px-3 py-1.5 rounded-lg text-xs" onclick="viewMemberPayments('${m.id}')">Payments</button>
              <button class="btn-outline px-3 py-1.5 rounded-lg text-xs" onclick="viewMemberCertificates('${m.id}')">Certificates</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="grid md:grid-cols-2 gap-6 mt-6">
        <div class="card p-5">
          <h3 class="font-display text-xl gold-text mb-3">Upcoming Events</h3>
          ${(d.upcomingEvents || []).map(e => `<div class="py-2 border-b border-[#222]"><div class="font-semibold">${esc(e.title)}</div><div class="text-xs text-gray-400">${fmtDate(e.date)} · ${esc(e.level)}</div></div>`).join('') || '<p class="text-gray-500 text-sm">No upcoming events.</p>'}
        </div>
        <div class="card p-5">
          <h3 class="font-display text-xl gold-text mb-3">Club News</h3>
          ${(d.announcements || []).map(a => `<div class="py-2 border-b border-[#222]"><div class="font-semibold">${esc(a.title)}</div><div class="text-sm text-gray-400">${esc(a.body)}</div></div>`).join('') || '<p class="text-gray-500 text-sm">Nothing yet.</p>'}
        </div>
      </div>
    `;
  }
  renderShell('dashboard', `<h1 class="font-display text-3xl gold-text mb-5">Welcome, ${esc(STATE.user.name)}</h1>${body}`);
});

async function viewMemberProfile(id) {
  const m = await api('/members/' + id);
  const promos = await api('/members/' + id + '/promotions');
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">${esc(m.name)}</h2>
    ${beltChip(m.beltName, m.beltColor)}
    <div class="mt-4 space-y-1 text-sm">
      <div><span class="text-gray-500">Date of Birth:</span> ${fmtDate(m.dob)}</div>
      <div><span class="text-gray-500">Gender:</span> ${esc(m.gender || '—')}</div>
      <div><span class="text-gray-500">Phone:</span> ${esc(m.phone || '—')}</div>
      <div><span class="text-gray-500">Address:</span> ${esc(m.address || '—')}</div>
      <div><span class="text-gray-500">Joined:</span> ${fmtDate(m.joinDate)}</div>
      <div><span class="text-gray-500">Status:</span> ${esc(m.status)}</div>
    </div>
    <h3 class="font-display text-lg gold-text mt-4 mb-2">Promotion History</h3>
    ${promos.length ? promos.map(p => `<div class="text-sm py-1 border-b border-[#222]">${fmtDate(p.date)} — promoted (belt order ${p.fromOrder} → ${p.toOrder}) by ${esc(p.examiner)}</div>`).join('') : '<p class="text-gray-500 text-sm">No promotions recorded yet.</p>'}
    <button class="btn-outline w-full py-2 rounded-lg mt-4" onclick="closeModal()">Close</button>
  `);
}
async function viewMemberAttendance(id) {
  const rows = await api('/members/' + id + '/attendance');
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Attendance History</h2>
    <table class="data-table"><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td class="${r.status === 'present' ? 'text-green-400' : 'text-red-400'}">${esc(r.status)}</td></tr>`).join('') || '<tr><td colspan="2" class="text-gray-500">No records yet.</td></tr>'}
    </tbody></table>
    <button class="btn-outline w-full py-2 rounded-lg mt-4" onclick="closeModal()">Close</button>
  `);
}
async function viewMemberPayments(id) {
  const rows = await api('/members/' + id + '/payments');
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Payment History</h2>
    <table class="data-table"><thead><tr><th>Date</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.period)}</td><td>${money(r.amount, r.currency)}</td><td>${esc(r.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-gray-500">No payments yet.</td></tr>'}
    </tbody></table>
    <button class="btn-outline w-full py-2 rounded-lg mt-4" onclick="closeModal()">Close</button>
  `);
}
async function viewMemberCertificates(id) {
  const rows = await api('/members/' + id + '/certificates');
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Certificates</h2>
    ${rows.map(c => `<div class="py-2 border-b border-[#222]"><div class="font-semibold">${esc(c.title)}</div><div class="text-xs text-gray-400">Issued ${fmtDate(c.dateIssued)}</div></div>`).join('') || '<p class="text-gray-500 text-sm">No certificates yet.</p>'}
    <button class="btn-outline w-full py-2 rounded-lg mt-4" onclick="closeModal()">Close</button>
  `);
}

// ============================================================
// MEMBERS (admin / instructor management view)
// ============================================================
route('/members', async () => {
  const canManage = ['admin', 'instructor'].includes(STATE.user.role);
  if (!canManage) { location.hash = '#/dashboard'; return; }
  const members = await api('/members');
  const belts = STATE.belts;
  renderShell('members', `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-display text-3xl gold-text">Members</h1>
      <button class="btn-gold px-4 py-2 rounded-lg" onclick="openAddMemberModal()">+ Add Member</button>
    </div>
    <div class="card p-4 overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Belt</th><th>Status</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${members.map(m => `
            <tr>
              <td>${esc(m.name)} ${m.isInstructor ? '<span class="text-xs gold-text">(Instructor)</span>' : ''}</td>
              <td>${beltChip(m.beltName, m.beltColor)}</td>
              <td><span class="${m.status === 'pending' ? 'text-yellow-400' : m.status === 'active' ? 'text-green-400' : 'text-gray-500'}">${esc(m.status)}</span></td>
              <td>${esc(m.phone || '—')}</td>
              <td>${fmtDate(m.joinDate)}</td>
              <td class="whitespace-nowrap">
                <button class="btn-outline px-2 py-1 rounded text-xs" onclick="viewMemberProfile('${m.id}')">View</button>
                <button class="btn-outline px-2 py-1 rounded text-xs" onclick="openEditMemberModal('${m.id}')">Edit</button>
                <button class="btn-outline px-2 py-1 rounded text-xs" onclick="openPromoteModal('${m.id}')">Promote</button>
                ${m.status === 'pending' ? `<button class="btn-gold px-2 py-1 rounded text-xs" onclick="openCreateAccountModal('${m.id}')">Approve & Create Login</button>` : ''}
                ${STATE.user.role === 'admin' ? `<button class="btn-red px-2 py-1 rounded text-xs" onclick="deleteMember('${m.id}')">Delete</button>` : ''}
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6" class="text-gray-500">No members yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
});

function memberFormFields(m = {}) {
  return `
    <div><label>Full Name *</label><input required name="name" value="${esc(m.name || '')}"/></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label>Date of Birth</label><input type="date" name="dob" value="${esc(m.dob || '')}"/></div>
      <div><label>Gender</label><select name="gender"><option value="">—</option><option ${m.gender === 'M' ? 'selected' : ''}>M</option><option ${m.gender === 'F' ? 'selected' : ''}>F</option></select></div>
    </div>
    <div><label>Phone</label><input name="phone" value="${esc(m.phone || '')}"/></div>
    <div><label>Email</label><input type="email" name="email" value="${esc(m.email || '')}"/></div>
    <div><label>Address</label><input name="address" value="${esc(m.address || '')}"/></div>
    <div><label>Belt / Sash</label><select name="beltOrder">${STATE.belts.map(b => `<option value="${b.order}" ${m.beltOrder === b.order ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
    <div><label>Status</label><select name="status">${['active', 'pending', 'inactive'].map(s => `<option ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div><label><input type="checkbox" name="isInstructor" ${m.isInstructor ? 'checked' : ''} style="width:auto;display:inline-block;margin-right:6px"/>Is an instructor</label></div>
    <div><label>Notes</label><textarea name="notes" rows="2">${esc(m.notes || '')}</textarea></div>
  `;
}

function openAddMemberModal() {
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Add Member</h2>
    <form id="member-form" class="space-y-3">${memberFormFields()}
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save</button>
    </form>
  `);
  document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.isInstructor = fd.get('isInstructor') === 'on';
    try { await api('/members', { method: 'POST', body }); toast('Member added.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function openEditMemberModal(id) {
  const m = await api('/members/' + id);
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Edit Member</h2>
    <form id="member-form" class="space-y-3">${memberFormFields(m)}
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save Changes</button>
    </form>
  `);
  document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.isInstructor = fd.get('isInstructor') === 'on';
    try { await api('/members/' + id, { method: 'PUT', body }); toast('Member updated.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function deleteMember(id) {
  if (!confirm('Remove this member permanently?')) return;
  try { await api('/members/' + id, { method: 'DELETE' }); toast('Member removed.'); router(); }
  catch (err) { toast(err.message, true); }
}
function openPromoteModal(id) {
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Promote Member</h2>
    <form id="promote-form" class="space-y-3">
      <div><label>New Belt / Sash</label><select name="toOrder">${STATE.belts.map(b => `<option value="${b.order}">${esc(b.name)}</option>`).join('')}</select></div>
      <div><label>Examiner</label><input name="examiner" value="${esc(STATE.user.name)}"/></div>
      <div><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Confirm Promotion</button>
    </form>
  `);
  document.getElementById('promote-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api('/members/' + id + '/promote', { method: 'POST', body });
      toast('Promotion recorded!');
      closeModal(); router();
    } catch (err) { toast(err.message, true); }
  });
}
function openCreateAccountModal(id) {
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Create Login for Member</h2>
    <form id="acct-form" class="space-y-3">
      <div><label>Username</label><input required name="username"/></div>
      <div><label>Temporary Password</label><input required name="password"/></div>
      <div><label>Role</label><select name="role"><option value="member">Member</option><option value="parent">Parent (guardian account)</option><option value="instructor">Instructor</option></select></div>
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Create Account</button>
    </form>
  `);
  document.getElementById('acct-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api('/members/' + id + '/create-account', { method: 'POST', body });
      toast('Account created — share the username/password with them.');
      closeModal(); router();
    } catch (err) { toast(err.message, true); }
  });
}

// ============================================================
// CLASSES (schedule management)
// ============================================================
route('/classes', async () => {
  const classes = await api('/classes');
  const canManage = ['admin', 'instructor'].includes(STATE.user.role);
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  classes.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
  renderShell('classes', `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-display text-3xl gold-text">Training Schedule</h1>
      ${canManage ? `<button class="btn-gold px-4 py-2 rounded-lg" onclick="openAddClassModal()">+ Add Session</button>` : ''}
    </div>
    <div class="card p-4 overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Day</th><th>Time</th><th>Location</th><th>Capacity</th>${canManage ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${classes.map(c => `<tr><td>${esc(c.day)}</td><td>${esc(c.startTime)}–${esc(c.endTime)}</td><td>${esc(c.location)}</td><td>${c.capacity}</td>
            ${canManage ? `<td><button class="btn-outline px-2 py-1 rounded text-xs" onclick="openEditClassModal('${c.id}')">Edit</button> ${STATE.user.role === 'admin' ? `<button class="btn-red px-2 py-1 rounded text-xs" onclick="deleteClass('${c.id}')">Delete</button>` : ''}</td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
});
function classFormFields(c = {}) {
  return `
    <div><label>Day</label><select name="day">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => `<option ${c.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label>Start Time</label><input type="time" name="startTime" value="${esc(c.startTime || '17:00')}"/></div>
      <div><label>End Time</label><input type="time" name="endTime" value="${esc(c.endTime || '20:00')}"/></div>
    </div>
    <div><label>Location</label><input name="location" value="${esc(c.location || STATE.club.location)}"/></div>
    <div><label>Capacity</label><input type="number" name="capacity" value="${c.capacity || 30}"/></div>
  `;
}
function openAddClassModal() {
  openModal(`<h2 class="font-display text-2xl gold-text mb-3">Add Training Session</h2>
    <form id="class-form" class="space-y-3">${classFormFields()}<button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save</button></form>`);
  document.getElementById('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/classes', { method: 'POST', body }); toast('Session added.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function openEditClassModal(id) {
  const classes = await api('/classes');
  const c = classes.find(x => x.id === id);
  openModal(`<h2 class="font-display text-2xl gold-text mb-3">Edit Session</h2>
    <form id="class-form" class="space-y-3">${classFormFields(c)}<button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save Changes</button></form>`);
  document.getElementById('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/classes/' + id, { method: 'PUT', body }); toast('Session updated.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function deleteClass(id) {
  if (!confirm('Delete this session?')) return;
  try { await api('/classes/' + id, { method: 'DELETE' }); toast('Session deleted.'); router(); }
  catch (err) { toast(err.message, true); }
}

// ============================================================
// ATTENDANCE (admin / instructor)
// ============================================================
route('/attendance', async () => {
  if (!['admin', 'instructor'].includes(STATE.user.role)) { location.hash = '#/dashboard'; return; }
  const [classes, members] = await Promise.all([api('/classes'), api('/members')]);
  const activeMembers = members.filter(m => m.status === 'active');
  const today = new Date().toISOString().slice(0, 10);
  renderShell('attendance', `
    <h1 class="font-display text-3xl gold-text mb-4">Mark Attendance</h1>
    <div class="card p-5 mb-5">
      <div class="grid md:grid-cols-3 gap-3 items-end">
        <div><label>Session</label><select id="att-class">${classes.map(c => `<option value="${c.id}">${c.day} ${c.startTime}-${c.endTime}</option>`).join('')}</select></div>
        <div><label>Date</label><input type="date" id="att-date" value="${today}"/></div>
        <button class="btn-gold py-2.5 rounded-xl" onclick="loadAttendanceSheet()">Load Sheet</button>
      </div>
    </div>
    <div id="att-sheet" class="card p-4"></div>
  `);
  loadAttendanceSheet(activeMembers);
});
let __attMembersCache = null;
async function loadAttendanceSheet(members) {
  const classId = document.getElementById('att-class').value;
  const date = document.getElementById('att-date').value;
  if (!members) {
    if (!__attMembersCache) __attMembersCache = (await api('/members')).filter(m => m.status === 'active');
    members = __attMembersCache;
  } else { __attMembersCache = members; }
  const existing = await api(`/attendance?date=${date}&classId=${classId}`);
  const statusOf = (mid) => (existing.find(a => a.memberId === mid) || {}).status || 'present';
  document.getElementById('att-sheet').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Member</th><th>Belt</th><th>Status</th></tr></thead>
      <tbody>
        ${members.map(m => `
          <tr>
            <td>${esc(m.name)}</td>
            <td>${beltChip(m.beltName, m.beltColor)}</td>
            <td>
              <select data-member="${m.id}" class="att-status-select" style="width:auto">
                <option value="present" ${statusOf(m.id) === 'present' ? 'selected' : ''}>Present</option>
                <option value="absent" ${statusOf(m.id) === 'absent' ? 'selected' : ''}>Absent</option>
                <option value="excused" ${statusOf(m.id) === 'excused' ? 'selected' : ''}>Excused</option>
              </select>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="3" class="text-gray-500">No active members.</td></tr>'}
      </tbody>
    </table>
    ${members.length ? `<button class="btn-gold px-5 py-2.5 rounded-xl mt-4" onclick="saveAttendanceSheet()">Save Attendance</button>` : ''}
  `;
}
async function saveAttendanceSheet() {
  const classId = document.getElementById('att-class').value;
  const date = document.getElementById('att-date').value;
  const records = Array.from(document.querySelectorAll('.att-status-select')).map(sel => ({ memberId: sel.dataset.member, status: sel.value }));
  try {
    await api('/attendance', { method: 'POST', body: { classId, date, records } });
    toast('Attendance saved for ' + date + '.');
  } catch (err) { toast(err.message, true); }
}

// ============================================================
// PAYMENTS (admin / instructor)
// ============================================================
route('/payments', async () => {
  if (!['admin', 'instructor'].includes(STATE.user.role)) { location.hash = '#/dashboard'; return; }
  const [payments, members] = await Promise.all([api('/payments'), api('/members')]);
  const memberName = (id) => (members.find(m => m.id === id) || {}).name || 'Unknown';
  const total = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);
  renderShell('payments', `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-display text-3xl gold-text">Payments</h1>
      <button class="btn-gold px-4 py-2 rounded-lg" onclick="openRecordPaymentModal()">+ Record Payment</button>
    </div>
    ${STATE.user.role === 'admin' ? `<div class="stat-card mb-4 w-fit"><div class="stat-num">${money(total, STATE.club.currency)}</div><div class="text-xs text-gray-400">Total Confirmed Collections</div></div>` : ''}
    <div class="card p-4 overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Member</th><th>Amount</th><th>Method</th><th>Period</th><th>Date</th><th>Status</th><th>Reference</th></tr></thead>
        <tbody>
          ${payments.map(p => `<tr><td>${esc(memberName(p.memberId))}</td><td>${money(p.amount, p.currency)}</td><td>${esc(p.method)}</td><td>${esc(p.period)}</td><td>${fmtDate(p.date)}</td><td class="${p.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">${esc(p.status)}</td><td>${esc(p.reference || '—')}</td></tr>`).join('') || '<tr><td colspan="7" class="text-gray-500">No payments recorded yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
});
async function openRecordPaymentModal() {
  const members = (await api('/members')).filter(m => m.status === 'active');
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Record Payment</h2>
    <form id="pay-form" class="space-y-3">
      <div><label>Member</label><select name="memberId">${members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
      <div><label>Amount (${STATE.club.currency})</label><input type="number" name="amount" value="${STATE.club.monthlyFee || ''}" required/></div>
      <div><label>Method</label><select name="method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>
      <div><label>Period (e.g. 2026-09)</label><input name="period" value="${new Date().toISOString().slice(0,7)}"/></div>
      <div><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div><label>Reference (optional)</label><input name="reference"/></div>
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save Payment</button>
    </form>
  `);
  document.getElementById('pay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/payments', { method: 'POST', body }); toast('Payment recorded.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}

// ============================================================
// EVENTS
// ============================================================
route('/events', async () => {
  const events = await api('/events');
  const canManage = ['admin', 'instructor'].includes(STATE.user.role);
  renderShell('events', `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-display text-3xl gold-text">Events & Competitions</h1>
      ${canManage ? `<button class="btn-gold px-4 py-2 rounded-lg" onclick="openAddEventModal()">+ Add Event</button>` : ''}
    </div>
    <div class="grid md:grid-cols-2 gap-5">
      ${events.map(e => `
        <div class="card p-5">
          ${e.imageUrl ? `<img src="${e.imageUrl}" class="rounded-lg w-full h-40 object-cover mb-3"/>` : ''}
          <div class="flex justify-between items-start">
            <h3 class="font-display text-xl">${esc(e.title)}</h3>
            <span class="text-xs gold-text">${esc(e.level)}</span>
          </div>
          <p class="text-xs text-gray-500">${fmtDate(e.date)} · ${esc(e.location)} · ${esc(e.type)}</p>
          <p class="text-sm text-gray-300 mt-2">${esc(e.description)}</p>
          ${e.resultsSummary ? `<p class="text-sm gold-text mt-2">🏆 ${esc(e.resultsSummary)}</p>` : ''}
          ${canManage ? `<div class="mt-3">
            <button class="btn-outline px-2 py-1 rounded text-xs" onclick="openEditEventModal('${e.id}')">Edit</button>
            ${STATE.user.role === 'admin' ? `<button class="btn-red px-2 py-1 rounded text-xs" onclick="deleteEvent('${e.id}')">Delete</button>` : ''}
          </div>` : ''}
        </div>
      `).join('') || '<p class="text-gray-500">No events logged yet.</p>'}
    </div>
  `);
});
function eventFormFields(ev = {}) {
  return `
    <div><label>Title</label><input required name="title" value="${esc(ev.title || '')}"/></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label>Type</label><select name="type">${['Competition','Grading','Demonstration','Camp','Other'].map(t => `<option ${ev.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Level</label><select name="level">${['Local','Sector','District','Provincial','National','International'].map(t => `<option ${ev.level === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label>Date</label><input type="date" name="date" value="${esc(ev.date || '')}"/></div>
      <div><label>Location</label><input name="location" value="${esc(ev.location || '')}"/></div>
    </div>
    <div><label>Description</label><textarea name="description" rows="2">${esc(ev.description || '')}</textarea></div>
    <div><label>Results Summary</label><input name="resultsSummary" value="${esc(ev.resultsSummary || '')}"/></div>
  `;
}
function openAddEventModal() {
  openModal(`<h2 class="font-display text-2xl gold-text mb-3">Add Event</h2><form id="event-form" class="space-y-3">${eventFormFields()}<button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save</button></form>`);
  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/events', { method: 'POST', body }); toast('Event added.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function openEditEventModal(id) {
  const ev = (await api('/events')).find(x => x.id === id);
  openModal(`<h2 class="font-display text-2xl gold-text mb-3">Edit Event</h2><form id="event-form" class="space-y-3">${eventFormFields(ev)}<button class="btn-gold w-full py-2.5 rounded-xl mt-2">Save</button></form>`);
  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/events/' + id, { method: 'PUT', body }); toast('Event updated.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  try { await api('/events/' + id, { method: 'DELETE' }); toast('Event deleted.'); router(); }
  catch (err) { toast(err.message, true); }
}

// ============================================================
// CERTIFICATES (admin/instructor issue; members view own via dashboard)
// ============================================================
route('/certificates', async () => {
  if (!['admin', 'instructor'].includes(STATE.user.role)) { location.hash = '#/dashboard'; return; }
  const [certs, members] = await Promise.all([api('/certificates'), api('/members')]);
  const memberName = (id) => (members.find(m => m.id === id) || {}).name || 'Unknown';
  renderShell('certificates', `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-display text-3xl gold-text">Certificates</h1>
      <button class="btn-gold px-4 py-2 rounded-lg" onclick="openIssueCertModal()">+ Issue Certificate</button>
    </div>
    <div class="card p-4 overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Member</th><th>Title</th><th>Date Issued</th></tr></thead>
        <tbody>${certs.map(c => `<tr><td>${esc(memberName(c.memberId))}</td><td>${esc(c.title)}</td><td>${fmtDate(c.dateIssued)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-gray-500">None issued yet.</td></tr>'}</tbody>
      </table>
    </div>
  `);
});
async function openIssueCertModal() {
  const members = (await api('/members')).filter(m => m.status === 'active');
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">Issue Certificate</h2>
    <form id="cert-form" class="space-y-3">
      <div><label>Member</label><select name="memberId">${members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
      <div><label>Certificate Title</label><input required name="title" placeholder="e.g. Certificate of Belt Promotion — Green Sash"/></div>
      <div><label>Date Issued</label><input type="date" name="dateIssued" value="${new Date().toISOString().slice(0,10)}"/></div>
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Issue</button>
    </form>
  `);
  document.getElementById('cert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/certificates', { method: 'POST', body }); toast('Certificate issued.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================
route('/announcements', async () => {
  const list = await api('/announcements');
  const canManage = ['admin', 'instructor'].includes(STATE.user.role);
  renderShell('announcements', `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-display text-3xl gold-text">Announcements</h1>
      ${canManage ? `<button class="btn-gold px-4 py-2 rounded-lg" onclick="openAddAnnouncementModal()">+ New Announcement</button>` : ''}
    </div>
    <div class="space-y-3">
      ${list.map(a => `
        <div class="card p-4">
          <div class="flex justify-between items-start">
            <h3 class="font-display text-xl">${esc(a.title)}</h3>
            ${canManage ? `<button class="text-xs text-red-400" onclick="deleteAnnouncement('${a.id}')">Delete</button>` : ''}
          </div>
          <p class="text-xs text-gray-500">${fmtDate(a.date)}</p>
          <p class="text-sm text-gray-300 mt-1">${esc(a.body)}</p>
        </div>
      `).join('') || '<p class="text-gray-500">Nothing posted yet.</p>'}
    </div>
  `);
});
function openAddAnnouncementModal() {
  openModal(`
    <h2 class="font-display text-2xl gold-text mb-3">New Announcement</h2>
    <form id="ann-form" class="space-y-3">
      <div><label>Title</label><input required name="title"/></div>
      <div><label>Message</label><textarea name="body" rows="3"></textarea></div>
      <button class="btn-gold w-full py-2.5 rounded-xl mt-2">Post</button>
    </form>
  `);
  document.getElementById('ann-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/announcements', { method: 'POST', body }); toast('Announcement posted.'); closeModal(); router(); }
    catch (err) { toast(err.message, true); }
  });
}
async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try { await api('/announcements/' + id, { method: 'DELETE' }); toast('Deleted.'); router(); }
  catch (err) { toast(err.message, true); }
}

// ============================================================
// USERS / ACCOUNTS (admin only)
// ============================================================
route('/users', async () => {
  if (STATE.user.role !== 'admin') { location.hash = '#/dashboard'; return; }
  const users = await api('/users');
  renderShell('users', `
    <h1 class="font-display text-3xl gold-text mb-4">Accounts</h1>
    <div class="card p-4 overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td>
              <td>${u.active ? '<span class="text-green-400">Active</span>' : '<span class="text-red-400">Disabled</span>'}</td>
              <td>
                <button class="btn-outline px-2 py-1 rounded text-xs" onclick="toggleUserActive('${u.id}', ${!u.active})">${u.active ? 'Disable' : 'Enable'}</button>
                <button class="btn-outline px-2 py-1 rounded text-xs" onclick="resetUserPassword('${u.id}')">Reset Password</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);
});
async function toggleUserActive(id, active) {
  try { await api('/users/' + id, { method: 'PUT', body: { active } }); toast(active ? 'Account enabled.' : 'Account disabled.'); router(); }
  catch (err) { toast(err.message, true); }
}
async function resetUserPassword(id) {
  const pw = prompt('Enter a new temporary password for this account:');
  if (!pw) return;
  try { await api('/users/' + id, { method: 'PUT', body: { password: pw } }); toast('Password reset.'); }
  catch (err) { toast(err.message, true); }
}
