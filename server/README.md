# Cleaniq Nigeria API (`server/`)

Express 5 + MongoDB (Mongoose). Its own database (`cleaniq_ng`) — never the UK one.

## Run it locally
1. `cp .env.example .env` and fill in the values (see comments in the file). For local testing:
   `MONGODB_URI=mongodb://127.0.0.1:27017/cleaniq_ng`, two long random secrets, Paystack **test** keys.
2. `npm install`
3. `npm run seed` — creates the first owner admin (from `SEED_OWNER_*`) and the starter price list.
4. `npm run dev` — API on http://localhost:5050 (`GET /api/health` → `{ "ok": true }`).
5. In another terminal: `cd ../web && npm run dev` — the website forwards `/api` to the API.

## Tests
`npm test` — runs everything against a temporary in-memory database (no setup needed). Must pass before each commit.

## Paystack
- Webhook URL (Paystack dashboard → Settings → API Keys & Webhooks): `<PUBLIC_API_URL>/api/payments/paystack/webhook`
- Bookings are only confirmed by that webhook (signature checked) or by the server asking Paystack directly.
- Locally Paystack can't reach your laptop, so after paying, the payment page asks the server to verify
  with Paystack — that confirms test bookings without a webhook.

## Backups
See `scripts/README-backups.md` (daily backup at 3am Lagos time, copies off the VPS, restore steps).

## Main endpoints so far
| Method | Path | Who |
|---|---|---|
| GET | `/api/health` | public |
| POST | `/api/auth/admin/login`, GET `/api/auth/admin/me`, POST `/api/auth/admin/change-password` | admin |
| POST | `/api/auth/customer/request-code`, `/api/auth/customer/verify-code`, GET `/api/auth/customer/me` | customer |
| POST | `/api/auth/worker/login` | cleaner |
| GET | `/api/services` | public price list |
| GET | `/api/bookings/options` | public form options |
| POST | `/api/bookings/quote-price` | public — server-side price |
| POST | `/api/bookings` | public — creates a Pending booking + Paystack checkout |
| GET | `/api/bookings/:bookingId/status?reference=` | public, no personal details |
| POST | `/api/payments/paystack/webhook` | Paystack (signed) |
