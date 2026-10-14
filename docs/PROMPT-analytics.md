# Prompt: Analytics — company revenue and performance graphs (admin)

Copy everything below the line into Claude in the `cleaniq-nigeria` folder.

---

Build **Admin → Analytics** for Cleaniq Nigeria: graphs and numbers that show how the company is doing,
especially **revenue**. Use **Recharts** (add it to `web/`) styled to match the admin (dark green
background, emerald/mint lines and bars, white text, rounded cards, tooltips in naira). Owner and
manager roles only. All numbers come from a server endpoint — the browser never adds up money itself.

## Controls (top of the page)
- Date range: **This month, Last month, Last 3 months, Last 6 months, This year, Custom** — and
  **compare with the previous period** (show ▲ / ▼ % change on every card).
- Group by: **day / week / month**. Filter by service, Lagos area, payment option, cleaner.
- Export: CSV of the data behind each chart; "Download report" PDF of the whole page.

## Top cards (with % change vs previous period)
Revenue collected (₦) · Revenue booked (₦, including unpaid/upcoming) · Outstanding / overdue (₦) ·
Profit (revenue − cleaner pay − expenses) · Bookings completed · Average job value (₦) · Active
monthly subscriptions + monthly recurring revenue (MRR) · New customers · Repeat-customer rate ·
Quote → booking conversion %.

## Graphs
1. **Revenue over time** — area/line chart: collected vs booked, with the previous period as a faint
   line. Toggle VAT included/excluded.
2. **Revenue by payment option** — stacked bars: pay now, pay after, weekly billing, monthly
   subscriptions (shows how Nigeria's payment mix changes).
3. **Monthly recurring revenue (MRR)** — line: subscription revenue per month, new vs cancelled plans.
4. **Profit** — bars per month: revenue, cleaner pay (monthly payroll), expenses, profit line on top.
5. **Revenue by service** — donut + table (regular, deep, post-construction, add-ons…).
6. **Revenue by Lagos area** — horizontal bars (Lekki, Ikoyi, VI, Ajah, Ikeja, …).
7. **Bookings over time** — bars by status (completed, cancelled, upcoming).
8. **Outstanding & overdue** — ageing bars (due, 1–7 days late, 8–30, 30+) with the list of who owes.
9. **Cleaner performance** — table: jobs done, revenue brought in, rating, monthly pay, cost %.
10. **Quotes funnel** — requested → sent → accepted → paid.
11. **Top customers** — table: revenue in period, number of cleans, plan.

## Website & marketing tab (to match the UK Analytics page)
Like `~/cleaniq/src/admin/Analytics.jsx` (read it for reference): visitors, sessions, new users,
page views, bounce rate, average session, top pages, landing pages, traffic sources, devices, browsers,
top cities; Google Ads clicks, impressions, CTR, spend, leads, cost per lead; customer-app and
worker-app users. Use the Google Analytics Data API / Google Ads API with keys from `server/.env`
(never in code or chat); if the keys aren't set yet, show a clear "connect Google Analytics" card
instead of empty charts.

## Server
- `GET /api/admin/analytics/summary?from&to&group&compare&filters…` — returns every card and chart
  series in one response, computed with MongoDB aggregation in **Lagos time** (`Africa/Lagos`), money
  rounded once. Revenue "collected" = paid payments (minus refunds); "booked" = bookings in the period
  whatever their payment status. Cache results for 5 minutes.
- `GET /api/admin/analytics/export?chart=…` — CSV.
- Tests with known data: totals, grouping by day/week/month across month ends, refunds subtracted,
  subscriptions counted as MRR, Lagos-time day boundaries, previous-period comparison, and that non-owner
  roles are refused.

Make every chart readable on a phone (charts stack, tables become cards), with loading skeletons and an
empty state ("No paid bookings in this period yet"). Commit locally, then tell me in plain English what
each chart shows and how to check the numbers.
