# Prompt: build the Cleaniq Nigeria admin (all the UK admin functions)

Copy everything below the line into Claude in the `cleaniq-nigeria` folder.

---

Build the **Cleaniq Nigeria admin** at `/admin` in `web/`, backed by `server/` (see
`docs/PROMPT-booking-quote-blog.md` for the server, models and Paystack). It must have **every function
the UK admin has**. The UK admin is at `~/cleaniq/src/admin/` (pages) and `~/cleaniq/server/routes/`
(backend) — **read it to copy the behaviour, never edit it or import from it**.

Look and feel: same as the UK admin — dark green (`#061A13` / `#0B2D22`), white text, emerald accents,
left sidebar grouped by section, stat cards at the top of each page, tables that become cards on phones,
popups for details. Reuse one set of admin components (Sidebar, StatCard, Table, Modal, Badge, Button).

Nigeria changes everywhere: **naira (₦)**, money stored in kobo or 2-decimal naira consistently;
**Paystack** (payments, refunds, and **Paystack Transfers** for paying cleaners); **Lagos time (WAT,
UTC+1, no daylight saving)**; Lagos areas instead of postcodes; +234 phone numbers; VAT 7.5% (switchable);
SMS via a Nigerian provider (e.g. Termii) and WhatsApp.

**Security rules (learned from the UK project — do these from day one):**
- Every `/api/admin/*` and every write route checks the admin login (JWT) — no public admin routes.
- Staff roles: owner, manager, staff — each page/route checks the role.
- Passwords hashed (bcrypt); never show or store readable customer passwords.
- Rate-limit the admin login; log admin actions (who changed what) for the important pages.
- Deleted things go to a **Bin** and can be restored.

Build in phases. After each phase, tell me in plain English what to test, then wait for my OK.

## Phase 1 — run the business (must have first)
| Page | What it does | UK reference |
|---|---|---|
| Login + Dashboard | admin login; today's jobs, revenue, new bookings/quotes/leads at a glance | `AdminLayout.jsx`, `auth.js` |
| **Bookings** | list/search/filter by status/date; open a booking; change status; assign a cleaner; resend emails (confirmation, payment link, invoice); cancel/refund via Paystack; add notes | `Bookings.jsx`, `routes/bookings.js` |
| **New booking** | staff create a booking for a customer (with or without payment link) | `NewBookingPage.jsx` |
| Take payment | send/collect a Paystack payment for a booking | `AdminBookingPay.jsx` |
| **Calendar** | month/week view of all bookings and cleaners | `Calendar.jsx` |
| **Customers** + profile | all customers, their bookings, timeline, tags, reset password (new temporary password emailed — never show their own) | `Customers.jsx`, `CustomerProfile.jsx` |
| **Staff (cleaners)** | add cleaners (welcome email with app links + login), details, availability, bank details, last login / last active, suspend | `Workers.jsx` |
| Applicants | job applications from the website, accept → create cleaner | `Applicants.jsx` |
| **Price list / Services** | main services and add-ons, hourly or fixed price, weekly/fortnightly/monthly rates, cleaner pay rates | `PriceList.jsx`, `ServicesManagement.jsx` |
| **Quote builder** + history | build and email a quote with an Accept button; see sent/accepted/expired | `QuoteBuilder.jsx`, `QuoteHistory.jsx`, `routes/quotes.js` |
| **Jobs**, assign jobs, job visibility | jobs offered to cleaners, who accepted, assign manually, hide a job / show only to chosen cleaners | `Jobs.jsx`, `AssignJobs.jsx`, `JobVisibility.jsx` |
| **Payments** | all payments and refunds (Paystack) | `AdminPayments.jsx` |
| **Staff pay** + withdrawals | what each cleaner earned, payouts (Paystack Transfers to Nigerian bank accounts), approve/reject withdrawals | `StaffPay.jsx`, `AdminWithdrawals.jsx` |
| Settings | business details, VAT, supplies fee, email/SMS settings, admin users & roles | `Settings.jsx` |
| Email history, Bin | every email sent (success/failed); restore deleted items | `EmailHistory.jsx`, `Bin.jsx` |

## Phase 2 — regular cleans, invoices and operations
| Page | What it does | UK reference |
|---|---|---|
| **Regular cleans (subscriptions)** | weekly/fortnightly/monthly plans: card saved with Paystack (authorization code), each visit charged 24h before, retries, pause/cancel, one regular cleaner, sign-up fee per hour | `Subscriptions.jsx`, `Recurring.jsx`, `server/utils/subscriptions.js` |
| Invoice builder | create/send invoices and receipts (PDF) | `InvoiceBuilder.jsx` |
| Rota | split a big job into shifts for several cleaners | `Rota.jsx` |
| Checklists | cleaning checklists per service | `Checklist.jsx` |
| Company jobs | jobs posted by business customers (estates, offices) to approve | `CompanyJobs.jsx` |
| Complaints, Contracts | log/resolve complaints (re-clean); business contracts | `Complaints.jsx`, `Contracts.jsx` |
| Tasks / To-do | team task list | `Tasks.jsx`, `TodoPage.jsx` |
| Expenses | business expenses | `Expenses.jsx` |
| Chat | messages between staff, cleaners and customers | `Chat.jsx` |
| Domestic / Commercial hubs, Property report | overview pages for homes vs businesses; property inspection reports | `DomesticHub.jsx`, `CommercialHub.jsx`, `PropertyReport.jsx` |
| Org chart | team structure | `OrgChart.jsx` |

## Phase 3 — marketing and growth
| Page | What it does | UK reference |
|---|---|---|
| **Blog** | posts, schedule, insert link, Draft with AI, autopilot (see the other prompt) | `Blog.jsx` |
| **Leads** + Pipeline | every enquiry/quote request; move through stages (new → quoted → won/lost) | `Leads.jsx`, `Pipeline.jsx` |
| Campaigns, Cold email | email campaigns to customers/leads, cold email sequences | `Campaigns.jsx`, `ColdEmail.jsx` |
| Automations, SMS automation | automatic follow-ups, reminders, review requests by email/SMS | `Automations.jsx`, `SmsAutomation.jsx` |
| Coupons, Referrals | discount codes; refer-a-friend | `Coupons.jsx`, `Referrals.jsx` |
| **Commission (creators)** | influencer codes and links, % commission earned when the job is done and paid | `Commission.jsx`, `server/utils/creators.js` |
| Generate links, Guide distribution | trackable links; send guides/PDFs to customers | `GenerateLinksPage.jsx`, `GuideDistribution.jsx` |
| **Analytics** | revenue, bookings, conversion, top services/areas | `Analytics.jsx` |

## Phase 4 — AI receptionist
| Page | What it does | UK reference |
|---|---|---|
| AI receptionist | knowledge base, settings, WhatsApp conversations, phone calls log; the AI answers customers, gives prices from the price list, books and sends quotes, saves enquiries as leads | `src/admin/ai/*`, `server/utils/aiBrain.js`, `aiTools.js`, `voice.js` |

Nigeria: WhatsApp first (it's how Lagos customers book); phone AI later if wanted.

## Rules for every page
- Data comes from the server only; every admin API checks the login and role.
- Loading, empty and error states on every page; confirm before deleting.
- Works on a phone (tables → cards); no horizontal scroll.
- Tests for every server route (node:test + mongodb-memory-server).
- Commit locally after each page (don't push). Tell me in plain English what to check.
