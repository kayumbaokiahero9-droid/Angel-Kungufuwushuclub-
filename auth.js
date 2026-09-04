// lib/auth.js
const crypto = require('crypto');
const store = require('./store');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function issueSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = db.sessions.filter(s => s.expiresAt > Date.now()); // sweep expired
  db.sessions.push({ token, userId, expiresAt: Date.now() + SESSION_TTL_MS });
  store.save(db);
  return token;
}

function getUserFromToken(db, token) {
  if (!token) return null;
  const session = db.sessions.find(s => s.token === token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return db.users.find(u => u.id === session.userId) || null;
}

function revokeSession(db, token) {
  db.sessions = db.sessions.filter(s => s.token !== token);
  store.save(db);
}

function requireAuth(req) {
  const db = store.load();
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = getUserFromToken(db, token);
  return { db, user, token };
}

// Role check helper. `roles` is an array of allowed roles.
function hasRole(user, roles) {
  return !!user && roles.includes(user.role);
}

module.exports = { issueSession, getUserFromToken, revokeSession, requireAuth, hasRole };
