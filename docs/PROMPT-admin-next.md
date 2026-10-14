# Prompt: next admin steps — match the UK dashboard, Nigeria pricing & pay, Quote pages

Copy everything below the line into Claude in the `cleaniq-nigeria` folder.

---

## Where we are (checked 14 Oct)
Built: admin login (cinematic), Dashboard, Calendar, Bookings (+ detail, New booking), Jobs, Customers
(+ profile), Cleaners (Staff), Applicants, Change password. Server routes exist for quotes, payments,
staff pay, price list, settings, records.
In the sidebar but **not built yet** (they fall through to "Coming next"): Quote builder, Quote history,
Payments, Staff pay, Price list, Settings, Email history, Bin.

**Goal: the Nigeria admin must have every page and function of the UK admin** (`~/cleaniq/src/admin/` —
read for reference only, never edit). The full list and phases are in `docs/PROMPT-admin.md`; this prompt
adds the Nigeria money rules and the order to build next.

## 1. IMPORTANT — Nigeria does NOT charge per hour
We copied the UK's hourly pricing. Change it everywhere (server pricing, Service model, booking page,
quote pages, admin price list, emails, tests):

**How customers are charged in Nigeria**
- **Per clean (per visit)**, priced by **service + property size** (bedrooms/bathrooms/property type)
  plus add-ons — not hours. Admin sets prices in the Price list as a table, e.g. Deep cleaning:
  1-bed flat ₦X, 2-bed ₦Y, 3-bed duplex ₦Z…, and add-ons (laundry, ironing, fridge, oven, windows…).
  Keep "estimated duration" only as information for scheduling cleaners, never in the price.
- Post-construction / large jobs: priced per job from a quote (see section 3).

**When customers pay — three options (admin chooses per customer/booking, the customer can pick on the site where allowed):**
1. **Monthly subscription** — a plan of N cleans per week or month (e.g. "2 cleans a week") for a fixed
   **monthly price**. Paid monthly in advance with Paystack; card saved (Paystack authorization code)
   and charged automatically each month on the plan's billing day; payment link if the card fails,
   retries, then pause the plan. Admin page **Subscriptions** (like the UK `Subscriptions.jsx`): plans,
   status (active / paused / payment due / cancelled), next billing date, visits this month, one regular
   cleaner, pause/cancel, change plan.
2. **Pay after the work** — the clean is done first; the customer pays **the day after** (or a set number
   of days). On completion the server creates an invoice and sends a Paystack payment link; reminder if
   unpaid after 1 day, then 3 days; overdue list for admin; admin can block "pay later" for a customer.
3. **Weekly billing** — all of a customer's cleans in a week are added up and charged/invoiced once a week
   (choose the billing day, e.g. Monday for the week before).
Also keep **pay now** for one-off bookings on the website. Every booking records its payment plan
(`payNow` | `payAfter` | `weekly` | `subscription`), due date, and status (unpaid / paid / overdue /
refunded). Bookings on "pay after" or "weekly" are **confirmed and given to cleaners without upfront
payment** (they are trusted customers). Subscriptions are confirmed while the plan is paid up.

**How cleaners are paid in Nigeria**
- **Monthly**, not per job. Each cleaner has either a **monthly salary** or **pay per completed job**
  (set in their profile) — both are paid **once a month on payday** (e.g. the 28th, set in Settings).
- **Staff pay** page: for the month, each cleaner's jobs completed, earnings, deductions/bonuses (with a
  note), total; mark as paid or pay through **Paystack Transfers** to their Nigerian bank account
  (bank + account number verified with Paystack's resolve-account); payslip PDF + email; history by month.
- Remove the per-job withdrawal requests from the cleaner side (they don't withdraw; payday pays them).
  The worker app later shows "this month so far" and "next payday".

## 2. Build next, in this order (one page at a time, test, commit, tell me)
1. **Price list** (new Nigeria pricing above) and **Settings** (business details, VAT 7.5% on/off,
   payday, pay-after days, weekly billing day, Paystack/email/SMS status, admin users & roles).
2. **Quote builder** + **Quote history** (section 3).
3. **Payments** — every payment, refund and overdue invoice; filters; export CSV.
4. **Subscriptions** (monthly plans) and **Invoices** (pay-after and weekly billing, overdue list,
   reminders, mark paid manually for cash/transfer).
5. **Staff pay** (monthly payroll above).
6. **Email history** and **Bin**.
7. Then the rest of the UK admin from `docs/PROMPT-admin.md` phases 2–4: invoice builder, rota/shifts,
   checklists, company jobs, complaints, contracts, tasks/to-do, expenses, chat, hubs, property report,
   org chart, blog (schedule, AI draft, autopilot), leads & pipeline, campaigns, cold email, automations,
   SMS automation, coupons, referrals, creator commission, generate links, guide distribution,
   **analytics** (see `docs/PROMPT-analytics.md`), AI receptionist, job visibility, assign jobs.
Keep the UK look (dark green admin, stat cards, tables → cards on phones) and the security rules
(admin login + role on every route, server decides prices, tests for every route).

## 3. Quote pages
**Admin → Quote builder** (like UK `QuoteBuilder.jsx`): pick or type the customer, add lines from the
price list (service + property size + add-ons) or custom lines with a price, quantity, discount, VAT
on/off, notes, valid-until (30 days), choose the payment option (pay now / pay after / weekly /
monthly plan). Preview, then **email it** with an **Accept** button (and a WhatsApp share link).
**Quote history**: sent / viewed / accepted / declined / expired, resend, duplicate, convert to booking.

**Website → Get a Quote page** (`/get-a-quote`, like the UK one — same 4-step look as the Booking page):
service, Lagos area + address, property type and rooms, add-ons, preferred date/time, name, email,
phone (+234), consent → the server prices it with the new per-clean pricing and emails the quote
instantly (or tells them "we'll send it shortly" for jobs that need a visit). Saves a Lead.

**Public quote page** (`/quote/:ref`): shows the quote; **Accept** → choose/confirm date and time →
creates the booking with the quote's payment option (pay now → Paystack; pay after / weekly → confirmed;
monthly → starts the subscription with the first month's payment).
