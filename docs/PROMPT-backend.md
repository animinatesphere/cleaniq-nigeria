# Prompt: build the Cleaniq Nigeria backend (`server/`)

Copy everything below the line into Claude in the `cleaniq-nigeria` folder.

---

Build the **Cleaniq Nigeria backend** in its own folder, **`cleaniq-nigeria/server/`** (already started:
Express 5, Mongoose, bcryptjs, jsonwebtoken, express-rate-limit, cors; `src/` with `lib/`,
`middleware/`, `models/`, `routes/`; `tests/`). It is the API for the website (`web/`), the admin, and later
the customer and worker apps. It is completely separate from the UK backend (`~/cleaniq/server`) — **read
the UK code to copy how things work, never edit it, import from it, or use its database**.

Follow `docs/PROMPT-booking-quote-blog.md` (booking, quotes, blog) and `docs/PROMPT-admin.md` (admin
phases) for what each feature must do. This prompt is the backend foundation and the rules.

## Setup
- CommonJS, Node 20+, entry `src/index.js`. Config only from environment variables, loaded from
  `server/.env` (git-ignored). Create **`server/.env.example`** listing every key with a comment, no real
  values: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `FRONTEND_URL`, `PUBLIC_API_URL`,
  `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `TERMII_API_KEY` (SMS),
  `ANTHROPIC_API_KEY` (blog AI / receptionist). Refuse to start if a required key is missing.
  Never put keys in code or ask me to paste them in chat.
- Its **own MongoDB database**, `cleaniq_ng`, **running on our VPS** (MongoDB Community installed on the
  VPS, listening on `127.0.0.1` only — never open to the internet — with a database user and password;
  `MONGODB_URI=mongodb://<user>:<pass>@127.0.0.1:27017/cleaniq_ng?authSource=admin`). Never the UK database.
  Because the database lives on the same VPS, **backups are our job**: add `scripts/backup-db.js`
  (mongodump → compressed file) and a daily cron at 3am Lagos time that keeps the last 14 copies on the
  VPS **and uploads each copy off the VPS** (e.g. to a cloud storage bucket or emailed/synced elsewhere),
  plus `scripts/restore-db.js` with clear instructions. Test the restore once.
- `GET /api/health` → `{ ok: true }`.
- CORS only for `FRONTEND_URL` (and localhost in development). JSON body limit 1 MB.
- `npm run dev` (watch), `npm start`, `npm test`, `npm run seed` (creates the first owner admin from
  env vars and a starter Nigeria price list in naira).

## Structure
```
src/
  index.js            app setup, routes, schedulers, start
  config.js           reads/validates env
  lib/                db, email (Resend + branded templates), sms (Termii), paystack, money, time (Lagos), pdf
  middleware/         auth (customer, admin + roles, worker), rateLimit, errors, validate
  models/             Admin, Customer, Worker, Service, Booking, Quote, Lead, BlogPost, Payment,
                      Subscription, Withdrawal, EmailLog, Notification, SystemSetting, TrashItem, AuditLog
  routes/             auth, services, bookings, quotes, payments (Paystack + webhook), blog, customers,
                      workers (+ worker app), admin/* (one file per admin area)
  jobs/               schedulers (reminders, regular-clean charges, blog autopilot)
tests/                node:test + mongodb-memory-server, one file per area
```

## Non-negotiable rules (lessons from the UK project)
1. **Every admin and write route needs a login.** Admin JWT + role check (`owner`, `manager`, `staff`).
   Customer routes check the customer JWT and that the record is theirs. Worker routes check the worker
   JWT. Add a test for each route proving it refuses without login.
2. **The server decides prices.** Never trust an amount, status, or "paid" flag sent by the browser.
3. **Paystack:** amounts in kobo; create transactions server-side; confirm payments **only** from the
   webhook (verify `x-paystack-signature` = HMAC-SHA512 of the raw body with the secret key) or a
   server-side `transaction/verify` call; make confirmation **atomic and once** (Paystack can resend).
   Refunds and cleaner payouts (Transfers to Nigerian bank accounts) via the Paystack API.
4. **Passwords:** bcrypt; never stored or shown readable. Admin "reset password" emails a temporary one.
5. **Rate-limit** logins, quote requests (3 per email per day), and public forms. Strip HTML from
   anything users type before it goes into emails.
6. **Customer privacy:** cleaners never receive a customer's email or phone through the worker API —
   only first name, area and job details. Public endpoints never return personal details.
7. **Money:** naira, 2 decimals, rounded once; VAT 7.5% switchable in settings.
8. **Time:** Lagos time (`Africa/Lagos`, UTC+1, no daylight saving) for schedules, reminders and emails.
9. **Deleting** moves things to a Bin (`TrashItem`) that admin can restore.
10. **Errors:** one error handler; clear JSON messages; never leak stack traces in production.
11. **Tests** for every route and every money/time calculation; `npm test` must pass before each commit.

## Build order
1. Foundation: config, db, error handling, health, auth (admin login + roles, customer signup/login with
   email code, worker login), seed, tests.
2. Price list (`Service`) + server-side price calculation.
3. Bookings + Paystack (initialize, webhook, verify) + booking emails.
4. Quotes (request from the website → instant quote email with Accept → booking + payment link).
5. Blog (public list/detail with scheduling; admin CRUD; AI draft; autopilot job).
6. Admin APIs in the phases of `docs/PROMPT-admin.md`.
7. Worker app API (job feed, accept, arrive, start, complete with photos, earnings) and customer app API.

## Deployment notes (for later)
Runs as its own process on the VPS (e.g. pm2 name `cleaniq-ng-api`, its own port), its own domain
(e.g. `api.cleaniq.ng`), separate from the UK `cleaniq-api`. MongoDB runs on the same VPS (see Setup);
run `scripts/backup-db.js` before each deploy as well as the daily backup. Check the VPS has enough RAM
for MongoDB + both APIs (MongoDB needs ~1 GB to be comfortable) and enough disk; tell me if it doesn't.

Commit locally after each step (don't push). After each step, tell me in plain English what works and
how to test it.
