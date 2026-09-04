// lib/store.js
// Zero-dependency JSON-file data store. Simple, transparent, good enough for a
// club of hundreds of members. Swap for a real DB later if you outgrow this.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

function nowIso() { return new Date().toISOString(); }
function uid(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

const DEFAULT_BELTS = [
  { order: 1, name: 'White Sash', color: '#f5f5f5' },
  { order: 2, name: 'Yellow Sash', color: '#f4d03f' },
  { order: 3, name: 'Orange Sash', color: '#e67e22' },
  { order: 4, name: 'Green Sash', color: '#27ae60' },
  { order: 5, name: 'Blue Sash', color: '#2980b9' },
  { order: 6, name: 'Purple Sash', color: '#8e44ad' },
  { order: 7, name: 'Brown Sash', color: '#7b4b2a' },
  { order: 8, name: 'Red Sash', color: '#c0392b' },
  { order: 9, name: 'Black Sash - 1st Duan', color: '#111111' },
  { order: 10, name: 'Black Sash - 2nd Duan', color: '#111111' },
  { order: 11, name: 'Black Sash - 3rd Duan', color: '#111111' },
];

function seed() {
  const adminPass = hashPassword('Admin@123');
  const instructorPass = hashPassword('Coach@123');
  const memberPass = hashPassword('Member@123');
  const parentPass = hashPassword('Parent@123');

  const adminId = uid('usr');
  const instructorId = uid('usr');
  const instMemberId = uid('mem');
  const memberUserId = uid('usr');
  const memberId = uid('mem');
  const parentUserId = uid('usr');
  const childMemberId = uid('mem');

  const db = {
    meta: { schoolName: 'Angels Kung Fu Wushu Club', createdAt: nowIso() },
    club: {
      name: 'Angels Kung Fu Wushu Club',
      tagline: 'Discipline • Strength • Respect • Excellence',
      motto: 'Train Hard. Fight Smart. Be an Angel.',
      location: 'Kimihurura, Murugando — beside ADEPR Church',
      phones: ['0783203747', '0788207031'],
      facebook: 'Angels Kung Fu Wushu Club',
      about: 'Angels Kung Fu Wushu Club trains children and adults in traditional Kung Fu and modern Wushu, building discipline, strength, respect and excellence both on and off the mat.',
      weeklyHours: 12.5,
      logoUrl: '/assets/logo.jpg',
      badgeUrl: '/assets/badge.jpg',
      galleryUrls: ['/assets/training1.jpg', '/assets/training2.jpg', '/assets/graduation.jpg'],
      currency: 'RWF',
      monthlyFee: 10000
    },
    belts: DEFAULT_BELTS,
    users: [
      { id: adminId, username: 'admin', role: 'admin', name: 'Chief Instructor / Owner',
        ...( { passwordSalt: adminPass.salt, passwordHash: adminPass.hash } ),
        memberId: null, linkedMemberIds: [], createdAt: nowIso(), active: true },
      { id: instructorId, username: 'coach.jean', role: 'instructor', name: 'Coach Jean',
        passwordSalt: instructorPass.salt, passwordHash: instructorPass.hash,
        memberId: instMemberId, linkedMemberIds: [], createdAt: nowIso(), active: true },
      { id: memberUserId, username: 'member.eric', role: 'member', name: 'Eric Niyonzima',
        passwordSalt: memberPass.salt, passwordHash: memberPass.hash,
        memberId: memberId, linkedMemberIds: [], createdAt: nowIso(), active: true },
      { id: parentUserId, username: 'parent.alice', role: 'parent', name: 'Alice Uwase',
        passwordSalt: parentPass.salt, passwordHash: parentPass.hash,
        memberId: null, linkedMemberIds: [childMemberId], createdAt: nowIso(), active: true },
    ],
    members: [
      { id: instMemberId, name: 'Coach Jean', dob: '1990-04-12', gender: 'M', phone: '0788000001',
        email: '', address: 'Kigali', beltOrder: 10, joinDate: '2015-01-10', status: 'active',
        isInstructor: true, guardianUserIds: [], photoUrl: '', notes: 'Head coach, Wushu specialist.' },
      { id: memberId, name: 'Eric Niyonzima', dob: '2008-06-01', gender: 'M', phone: '0788000002',
        email: '', address: 'Kimihurura', beltOrder: 5, joinDate: '2022-02-01', status: 'active',
        isInstructor: false, guardianUserIds: [], photoUrl: '', notes: '' },
      { id: childMemberId, name: 'Kevin Uwase', dob: '2014-09-20', gender: 'M', phone: '',
        email: '', address: 'Kimihurura', beltOrder: 2, joinDate: '2023-05-15', status: 'active',
        isInstructor: false, guardianUserIds: [parentUserId], photoUrl: '', notes: 'Child of Alice Uwase.' },
    ],
    promotions: [
      { id: uid('prm'), memberId: memberId, fromOrder: 4, toOrder: 5, date: '2024-11-03',
        examiner: 'Coach Jean', notes: 'Solid forms test.' }
    ],
    classes: [
      { id: uid('cls'), day: 'Monday', startTime: '17:00', endTime: '20:00', location: 'Kimihurura, Murugando', instructorId: instructorId, capacity: 40 },
      { id: uid('cls'), day: 'Wednesday', startTime: '17:00', endTime: '20:00', location: 'Kimihurura, Murugando', instructorId: instructorId, capacity: 40 },
      { id: uid('cls'), day: 'Friday', startTime: '17:00', endTime: '20:00', location: 'Kimihurura, Murugando', instructorId: instructorId, capacity: 40 },
      { id: uid('cls'), day: 'Sunday', startTime: '07:00', endTime: '10:30', location: 'Kimihurura, Murugando', instructorId: instructorId, capacity: 40 },
    ],
    attendance: [],
    payments: [
      { id: uid('pay'), memberId: memberId, amount: 10000, currency: 'RWF', method: 'Mobile Money',
        period: '2026-08', date: '2026-08-03', status: 'confirmed', recordedBy: adminId, reference: 'MM-880231' }
    ],
    events: [
      { id: uid('evt'), title: 'National Wushu Youth Championship', type: 'Competition', level: 'National',
        date: '2026-05-20', location: 'Kigali Arena', description: 'Angels team represented Rwanda in youth Wushu forms and sanda.',
        resultsSummary: 'Multiple medals across forms and sparring categories.', imageUrl: '/assets/graduation.jpg' }
    ],
    certificates: [
      { id: uid('cert'), memberId: memberId, title: 'Certificate of Belt Promotion — Blue Sash', dateIssued: '2024-11-03', eventId: null }
    ],
    announcements: [
      { id: uid('ann'), title: 'Welcome to the new Angels Kung Fu Wushu Club portal!', body: 'You can now check your belt rank, attendance, payments and upcoming events right here.', date: nowIso(), audience: 'all' }
    ],
    sessions: [] // login tokens
  };
  return db;
}

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DB_FILE)) {
    cache = seed();
    save(cache);
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('DB read failed, reseeding:', e.message);
    cache = seed();
    save(cache);
  }
  return cache;
}

function save(db) {
  cache = db;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { load, save, uid, nowIso, hashPassword, verifyPassword, DEFAULT_BELTS };
