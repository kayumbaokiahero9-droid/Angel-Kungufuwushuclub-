# Angels Kung Fu Wushu Club — Full-Stack Club Management Web App

A complete, real, running full-stack web application for **Angels Kung Fu Wushu Club** —
rebuilt from the ground up (not adapted from the School SMS codebase) as a purpose-built
martial arts club management system: public site + member/parent/instructor/admin portal,
one Node.js backend, one database file, zero build step, zero paid services required.

## Why this architecture

The School SMS reference app you shared depends on Firebase (external project, billing,
security-rule deployment, MTN/Airtel merchant accounts, etc.) before a single feature
actually works end-to-end. For a kung fu club that just needs to **run today**, this build
instead uses:

- **Backend:** Plain Node.js (built-in `http` module only — no Express, no npm install,
  no `node_modules`, nothing to go out of date).
- **Database:** A single JSON file (`data/db.json`), auto-created and auto-seeded the
  first time you run the server. Human-readable, easy to back up, easy to inspect.
- **Auth:** Real password hashing (`crypto.scrypt`, salted, per-user) and real server-side
  session tokens (not client-side pretend-auth) — no third-party auth provider needed.
- **Frontend:** A single-page app in plain HTML/CSS/JS (Tailwind via CDN for styling),
  talking to the backend over a REST API. No React build, no bundler.

This means: **`node server.js` and the whole thing works**, on your laptop, on a $5
VPS, or on any Node hosting (Render, Railway, Fly.io, a DigitalOcean droplet, etc.) —
nothing else to configure. When you outgrow the JSON file (many hundreds of members,
multiple simultaneous writers), swapping `lib/store.js` for a real database
(Postgres/SQLite) is a contained, one-file change — every route already goes through it.

## Running it

Requirements: Node.js 18+ (you have 22, which is fine).

```bash
node server.js
```

Then open **http://localhost:3000** in your browser. That's the entire setup.

To deploy: push this folder to any Node-friendly host and set the `PORT` environment
variable if the platform requires it (falls back to 3000). The `data/` folder must be on
persistent disk (not an ephemeral filesystem) so your data survives restarts/deploys.

## Demo logins (seeded automatically on first run)

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | Chief Instructor / Owner — full access |
| `coach.jean` | `Coach@123` | Instructor |
| `member.eric` | `Member@123` | Member |
| `parent.alice` | `Parent@123` | Parent (linked to a child member) |

**Change these before putting the app in front of real members** — go to
Accounts (admin-only) → Reset Password for each seeded account, or edit
`data/db.json` directly before first real use.

## What's actually built and working

### Public site (no login required)
- Branded landing page (club name, motto, tagline, logo, photo gallery — all pulled
  from your uploaded club branding)
- Live training schedule (Gahunda y'Imyitozo) rendered from real data, not hardcoded
  HTML — editable by staff without touching code
- Belt/sash ranking legend
- "Join the Club" public application form (creates a pending member record)
- Member/parent login

### Member & Parent Portal
- Personal dashboard: own profile, current belt/sash, promotion history
- Attendance history
- Payment history (amount paid, balance context, method, reference)
- Certificates earned
- Club-wide announcements and upcoming events (read-only)
- Parents see **only their own linked children** — never another family's data (enforced
  server-side on every request, not just hidden in the UI)

### Instructor Portal
- Everything members see, plus:
- Full member roster (add/edit members, view profiles)
- Mark attendance per class session (present/absent/excused), editable per date
- Promote members between belts/sashes, with a permanent promotion history log
- Log events & competitions (type, level, results, description)
- Issue certificates
- Post club announcements

### Admin Portal (Chief Instructor / Owner)
- Everything above, plus:
- Full dashboard: active member count, pending applications, total instructors, **total
  fees collected** (financial totals are restricted to admin only — instructors and
  everyone else never see school-wide money figures, matching how the reference app's
  audit said financial visibility should work)
- Approve pending applications and generate login credentials for new members/parents
- Record payments (cash / mobile money / bank transfer) with reference numbers
- Full class-schedule management (add/edit/delete sessions, days, times, location,
  capacity)
- Delete members/events/sessions
- **Accounts** tab: enable/disable any login, force-reset any password

### Security & correctness (tested, not assumed)
- Every API route re-checks the role server-side — the frontend hiding a button is never
  the only protection. Verified directly with curl: a member token gets `403` on staff
  actions, a disabled account gets `401` on login, a parent's dashboard only ever returns
  their own linked children's data.
- Passwords are salted and hashed with `scrypt` — never stored in plain text, never sent
  back to the client.
- Session tokens are random 256-bit values issued server-side and checked against a
  server-side session store on every request — not a client-trusted flag.
- All mutating actions (payments, promotions, attendance, account changes) require a
  valid session and the correct role.

## Project structure

```
kungfu-app/
├── server.js              # HTTP server + full REST API (single entry point)
├── lib/
│   ├── store.js            # JSON-file data layer, password hashing, seed data
│   └── auth.js              # Session issue/verify/revoke, role checks
├── data/
│   └── db.json              # Auto-created on first run — your actual data lives here
├── public/                  # Everything served to the browser
│   ├── index.html
│   ├── app.js               # Entire frontend SPA (routing, views, API calls)
│   ├── styles.css           # Club-branded black/gold/red theme
│   ├── manifest.json        # PWA metadata (installable on phones)
│   └── assets/               # Your club's real logo, badge, and photos
└── README.md
```

## API reference (for extending it yourself)

All endpoints are under `/api`. Authenticated endpoints expect
`Authorization: Bearer <token>` from `/api/auth/login`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | Log in, returns token |
| POST | `/api/auth/logout` | authed | Revoke current session |
| GET | `/api/auth/me` | authed | Current user info |
| GET | `/api/club` | anyone | Public club profile |
| GET | `/api/belts` | anyone | Belt/sash rank list |
| POST | `/api/apply` | anyone | Public join application |
| GET | `/api/dashboard` | authed | Role-scoped dashboard data |
| GET/POST | `/api/members` | authed | List / create members |
| GET/PUT/DELETE | `/api/members/:id` | authed | View / edit / remove a member |
| POST | `/api/members/:id/create-account` | admin | Approve application → issue login |
| GET/POST | `/api/members/:id/promotions`, `/promote` | staff | Belt promotion + history |
| GET | `/api/members/:id/attendance`\|`/payments`\|`/certificates` | scoped | Own or managed records |
| GET/POST/PUT/DELETE | `/api/classes[/:id]` | staff to write | Weekly training schedule |
| GET/POST | `/api/attendance` | staff | Attendance sheets per session/date |
| GET/POST | `/api/payments` | staff | Fee collection ledger |
| GET/POST/PUT/DELETE | `/api/events[/:id]` | staff to write | Competitions & events |
| GET/POST | `/api/certificates` | staff | Certificate issuance |
| GET/POST/DELETE | `/api/announcements[/:id]` | staff to write | Club news |
| GET/PUT | `/api/users[/:id]` | admin | Manage login accounts |

## Honest limitations (so nothing here pretends to be more than it is)

- **Mobile Money / bank payments are recorded manually by staff**, not collected live
  through an MTN/Airtel API integration — that requires a merchant account and
  Cloud-Function-style server credentials that only you can obtain from the provider.
  The payment ledger, receipts, and balances are fully real; the *collection* step is a
  staff action (matching cash/reference number to a ledger entry), same as the "fallback"
  flow the reference app itself described as its safest option.
- **No email/SMS notifications yet** — announcements live in-app. Wiring up an email
  provider (e.g. Resend, SendGrid) or SMS gateway is a small, isolated addition once you
  have an account with one.
- **Single JSON file storage** is genuinely fine for a club (hundreds of members,
  low write concurrency) but isn't built for heavy concurrent multi-admin writes at
  large scale — see "Why this architecture" above for the upgrade path.
- **No built-in HTTPS** — put this behind any standard reverse proxy (Nginx, Caddy) or a
  host that terminates TLS for you (Render/Railway/Fly all do this automatically) before
  going live publicly.

## Next steps you may want

1. Change the seeded demo passwords immediately.
2. Add your real members/instructors through the Admin → Members screen.
3. Adjust `data/db.json`'s `club` object (or use the app once a Settings screen is added)
   for your exact fee amount, currency, and contact details.
4. Set up automatic backups of `data/db.json` (it's a single file — trivial to copy to
   cloud storage on a cron job).
