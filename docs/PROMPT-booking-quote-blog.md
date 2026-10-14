# Prompt: build Booking, Get a Quote and Blog for Cleaniq Nigeria (frontend + backend)

Copy everything below the line into Claude in the `cleaniq-nigeria` folder.

---

Build the **Booking**, **Get a Quote** and **Blog** features for Cleaniq Nigeria — the website pages
**and** the backend — so they match the landing page we already built in `web/` (same components in
`web/src/components/ui.jsx`, same colours/fonts from `web/src/index.css`, same Framer Motion animation
style from `web/src/motion.js`, same content style as `web/src/data.js`, logos in `web/src/assets/`).

They should work the way the UK Cleaniq system works (it's at `~/cleaniq` — **read it for reference
only, never edit it or import from it**), adapted for Nigeria: prices in **naira (₦)**, **Lagos** areas
instead of UK postcodes, **Paystack** for payments, WhatsApp as a main contact channel, phone numbers in
+234 format. Work step by step, show me each page when it's ready, and commit locally (don't push).

## 0. Backend first (new `server/` folder in cleaniq-nigeria)

Create `cleaniq-nigeria/server/` — Node + Express + MongoDB (Mongoose), its own database (never the UK
one). Settings in `server/.env` (git-ignored) with a `server/.env.example` listing the keys:
`MONGODB_URI`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` (frontend),
`EMAIL_FROM` + email provider key (Resend), `FRONTEND_URL`, `ANTHROPIC_API_KEY` (blog AI). Never put keys
in the code or in chat. Every admin route must require the admin login (the UK project had public admin
routes — don't repeat that). Write tests (node:test + mongodb-memory-server) for each flow.

Models (mirror the UK ones in `~/cleaniq/server/models`, simplified):
- **Service** — name, category (`Base` = main service, `Extras` = add-on), type (`hourly` | `flat`),
  rate in naira, optional weekly/fortnightly/monthly rates, active.
- **Booking** — bookingId (e.g. `NG-123456`), customer {firstName, lastName, email, phone}, service,
  details {area (Lagos area), address, landmark, duration (hours), frequency, rooms, extras, pets,
  parking/access notes, instructions}, schedule {date, time}, payment {amount, currency "NGN", status,
  method, reference, paidAt}, status (Pending → Confirmed → Assigned → In Progress → Completed /
  Cancelled), createdAt.
- **Quote** — quoteRef, customer details, items [{service, billingType, qty, unitPrice, extras,
  subtotal}], subtotal, VAT (Nigeria 7.5%, switchable in admin), grandTotal, status
  (Sent / Accepted / Declined / Expired), validUntil (30 days), serviceDate/time, acceptedAt.
- **BlogPost** — title, description, content, image, author, published, publishAt (scheduling),
  source ("manual" | "autopilot"), views, createdAt.
- **Lead** — every quote request / enquiry saved for follow-up.

## 1. Booking page (`/booking`) — like `~/cleaniq/src/pages/Booking.jsx`

A 4-step form with a step bar at the top and a live **summary card** on the side (on mobile: below),
animated between steps:

1. **Location & service** — Lagos area (dropdown: Lekki, Ikoyi, Victoria Island, Ajah, Ikeja, Yaba,
   Surulere, Gbagada, Magodo, Maryland, …), full address + nearest landmark, service (from the
   Service list), one-off or regular (weekly / fortnightly / monthly — only frequencies the service
   offers), how many hours.
2. **Property** — property type (flat, duplex, terrace, bungalow, mansion, office), number of bedrooms,
   bathrooms, kitchens, living rooms, stairs; pets yes/no. At least one room required.
3. **Extras & access** — add-ons from the price list (oven, fridge, carpet, windows, laundry/ironing…)
   with quantities; who provides cleaning supplies (Cleaniq for a fee, or the customer); parking and
   how the cleaner gets in (someone home, gateman, key with security); special instructions.
4. **Date, time, your details & pay** — calendar (from tomorrow), arrival time 8am–6pm on the half
   hour, full name, email, phone (+234), then the price breakdown and **Pay with Paystack**.

Rules: validate each step before moving on (clear messages, like the UK site); prices always come from
the server's price list (the browser never decides the price); the total = hourly rate × hours +
extras + supplies fee (+ VAT if switched on); save the form in the browser so a refresh doesn't lose it.

Backend:
- `GET /api/services` — the price list.
- `POST /api/bookings/quote-price` — returns the exact total for the form (server-side maths).
- `POST /api/bookings` — creates the booking as **Pending** and a Paystack transaction
  (`/transaction/initialize`) in kobo; returns the Paystack checkout URL / access code.
- `POST /api/payments/paystack/webhook` — verifies the Paystack signature (`x-paystack-signature`,
  HMAC SHA512), and on `charge.success` marks the booking **Confirmed** exactly once (atomic update —
  Paystack can send the same event twice), records the payment reference, and sends the
  confirmation email. Never confirm a booking from the browser redirect alone.
- `/payment/success` page after Paystack: shows "Payment successful" and the booking reference.
- Emails (branded, green like the site): booking received / payment link, booking confirmed,
  reminder the day before, "your clean is done" + invoice/receipt when completed.

## 2. Get a Quote page (`/get-a-quote`) — like `~/cleaniq/src/pages/GetQuote.jsx`

Same 4-step look as Booking (Location → Property → Add-ons → Schedule) with the summary card and a
"Ready to send" progress bar, but **no payment** — it ends with "Send my quote":

- Step 1: service, hours, Lagos area, address, who provides supplies.
  **Fixed-price services (carpet cleaning, oven cleaning)**: don't ask for hours or supplies — ask
  "How many carpets / rooms?" or "Which oven?" (single / double / range) and **skip the Add-ons step**.
- Step 2: property type and rooms, pets.
- Step 3: add-ons (offer "save 20% on additional services" when added to a clean).
- Step 4: preferred date and time, name, email, phone, notes, consent tick box.

Backend:
- `POST /api/quotes/request` — validates the form, saves a **Lead**, prices it from the price list
  (hourly rate × hours + add-ons; fixed price for carpet/oven), creates a **Quote** and **emails it
  straight away** with an **Accept** button; also emails the team. If it can't be priced (custom
  service), email the customer "we've received it, we'll send your quote shortly".
- Limit to 3 quotes per email per day; strip HTML from anything the customer types.
- `GET /quote/:ref` page — shows the quote; **Accept** lets them pick/confirm the date and time,
  turns it into a **Booking** (Pending) and sends a Paystack payment link. Once accepted, stop any
  follow-up reminder emails for that quote.
- Admin: list of quotes (Sent / Accepted / Expired), resend, mark declined.

## 3. Blog (`/blog` and `/blog/:slug`) — like `~/cleaniq/src/pages/Blog.jsx`, `BlogDetail.jsx`, `~/cleaniq/src/admin/Blog.jsx`

Website:
- `/blog` — featured latest post, then a grid of posts (photo, title, summary, date, read time),
  pagination. Only posts that are published **and** whose publish time has passed.
- `/blog/:slug` — the article. Post text supports: blank line = paragraph, `## ` = subheading,
  `- ` = bullet, `[words](/booking)` or full `https://` links (site links stay in the tab, outside
  links open a new tab; only http(s) and `/…` links allowed — copy `~/cleaniq/src/utils/blogContent.jsx`'s
  approach). Show the publish date, author box, and a "Get a free quote" call to action.
- Each page sets its own title/description for Google (react-helmet-async).

Admin (simple `/admin` area with an admin login, dark green like the UK admin):
- Create / edit / delete posts with a cover photo upload.
- **Publish now / Schedule for later / Save as draft**; quick buttons "In 2 days / 3 days / 4 days /
  1 week". Scheduled posts stay hidden (even by direct link) until their time, then appear by
  themselves — no background job needed (filter by `publishAt <= now`).
- **Insert link** button in the editor.
- **Draft with AI** — type a topic, Claude writes title, summary and article (Nigerian/Lagos context,
  British spelling, links to our pages) into the form for review; nothing is saved automatically.
  Server route `POST /api/blog/admin/ai-draft` (admin only) using the Anthropic SDK with structured
  JSON output — follow `~/cleaniq/server/utils/blogWriter.js`.
- **Blog autopilot** — instructions + how often (every 2 / 3 / 4 days or weekly) + UK→**Lagos time**
  + publish or draft; the server checks every 10 minutes, writes a due post exactly once, rotates cover
  photos, retries a failure hourly up to 3 times — follow `~/cleaniq/server/utils/blogAutopilot.js`.

## 4. Connect it to the landing page

- Navbar and hero buttons: **Book now** → `/booking`, **Get a free quote** → `/get-a-quote`,
  **Blog** in the menu; keep the WhatsApp button everywhere.
- Use React Router; every page uses the same Navbar, Footer, colours and Framer Motion transitions.
- Fully responsive (test at phone width), accessible labels on every input, no horizontal scroll.

When each part works, tell me in plain English what to check and how to run it.
