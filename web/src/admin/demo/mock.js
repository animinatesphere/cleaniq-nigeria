// Demo mode (npm run demo): the admin runs entirely in the browser on sample Lagos data — no API, no
// database. Screens come from fixtures.json; saves, sends and deletes work for the session (changes
// are kept in memory and reset when the page reloads). Never part of the production build.
import FIXTURES from "./fixtures.json";

const data = structuredClone(FIXTURES);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const id = () => Math.random().toString(16).slice(2, 14).padEnd(24, "0");
const now = () => new Date().toISOString();
const ADMIN = data["/auth/admin/me"].admin;
// Every response key the pages read after a save, all pointing at the same object.
const KEYS = ["item", "lead", "expense", "invoice", "subscription", "post", "thread", "booking", "quote", "worker", "customer", "service", "applicant"];
const wrap = (obj) => Object.fromEntries(KEYS.map((k) => [k, obj]));

// Which list holds the items for a path (e.g. /admin/leads → board list).
const LISTS = { "/admin/leads": "/admin/leads", "/admin/expenses": "/admin/expenses" };
function listFor(base) {
  return data[LISTS[base] || base];
}

function filterList(res, params) {
  if (!res || !Array.isArray(res.items)) return res;
  let items = res.items;
  const val = (x, k) => x[k] ?? x.data?.[k] ?? x.payment?.[k];
  for (const k of ["status", "stage", "kind", "category", "source", "paymentStatus"]) {
    const v = params.get(k);
    if (!v) continue;
    if (k === "status" && v === "Overdue") items = items.filter((x) => x.status === "Unpaid" && x.dueDate < now().slice(0, 10));
    else if (k === "paymentStatus") items = items.filter((x) => x.payment?.status === v);
    else items = items.filter((x) => String(val(x, k)) === v);
  }
  if (params.get("kinds")) { const ks = params.get("kinds").split(","); items = items.filter((x) => ks.includes(x.kind)); }
  const q = (params.get("q") || "").toLowerCase().trim();
  if (q) items = items.filter((x) => JSON.stringify(x).toLowerCase().includes(q));
  if (params.get("board") === "1") return { ...res, items, total: items.length };
  const limit = Number(params.get("limit")) || 25;
  const page = Number(params.get("page")) || 1;
  return { ...res, items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
}

function get(path) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (data[path]) return data[path];
  if (pathname === "/admin/bookings/calendar") {
    const from = params.get("from"), to = params.get("to");
    return { items: data["/admin/bookings"].items.filter((b) => b.status !== "Cancelled" && b.schedule?.date >= from && b.schedule?.date <= to) };
  }
  if (pathname === "/admin/expenses" && params.get("month") && params.get("month") !== data["/admin/expenses"].month) {
    const other = Object.entries(data).find(([k]) => k === `/admin/expenses?month=${params.get("month")}`)?.[1];
    return filterList(other || { ...data["/admin/expenses"], items: [], total: 0, monthTotal: 0, byCategory: [], month: params.get("month") }, params);
  }
  if (pathname === "/admin/analytics" && params.get("months")) return data[`/admin/analytics?months=${params.get("months")}`] || data["/admin/analytics"];
  if (data[pathname]) return filterList(data[pathname], params);
  if (/^\/admin\/c\/\w+$/.test(pathname)) return { items: [], total: 0, page: 1, limit: 25, counts: {} };
  return { items: [], total: 0, page: 1, limit: 25, counts: {} };
}

// Finds an item (by _id / ref / number) in any list, for edits.
function findItem(key) {
  for (const [k, v] of Object.entries(data)) {
    if (!Array.isArray(v?.items)) continue;
    const hit = v.items.find((x) => [x._id, x.bookingId, x.invoiceNo, x.ref, x.quoteRef, x.slug].includes(key));
    if (hit) return { list: k, item: hit, all: v };
  }
  return null;
}
function detailKey(path) {
  const parts = path.split("?")[0].split("/");
  while (parts.length > 2) { const p = parts.join("/"); if (data[p] && !Array.isArray(data[p].items)) return p; parts.pop(); }
  return null;
}

// Price previews for New booking / Quote builder, from the sample price list (same rules as the server:
// size prices by property and bedrooms, fixed prices, extras, supplies fee, VAT).
const SERVICES = data["/services"];
function priceOne({ serviceSlug, service, propertyType = "Flat", bedrooms = 2, bathrooms = 1, qty = 1, extras = [], option, unitPrice, label }) {
  const svc = SERVICES.base.find((x) => x.slug === (serviceSlug || service));
  if (!svc) return { service: label || "Custom", qty, unitPrice: Number(unitPrice) || 0, subtotal: (Number(unitPrice) || 0) * qty, lines: [] };
  let price = Number(unitPrice) || svc.rate || 0;
  let size = "";
  if (svc.pricing === "size") {
    const row = svc.sizePrices.filter((r) => r.propertyType === propertyType).sort((a, b) => Math.abs(a.bedrooms - bedrooms) - Math.abs(b.bedrooms - bedrooms))[0] || svc.sizePrices[0];
    price = Number(unitPrice) || row.price + Math.max(0, Number(bathrooms) - Math.max(1, row.bedrooms)) * (svc.extraBathroomPrice || 0);
    size = `${row.bedrooms ? `${row.bedrooms}-bed` : "Studio"} ${row.propertyType}`;
  }
  if (svc.pricing === "quote" && !unitPrice) price = 150000;
  const ex = (Array.isArray(extras) ? extras : Object.entries(extras).map(([slug, q]) => ({ slug, qty: q }))).filter((e) => Number(e.qty) > 0).map((e) => {
    const x = SERVICES.extras.find((y) => y.slug === e.slug) || { name: e.slug, rate: 0 };
    return { slug: e.slug, name: x.name, qty: Number(e.qty), unitPrice: x.rate };
  });
  const extrasTotal = ex.reduce((t, e) => t + e.qty * e.unitPrice, 0);
  return { service: svc.name, size, option, qty: Number(qty) || 1, unitPrice: price, extras: ex, subtotal: price * (Number(qty) || 1) + extrasTotal,
    lines: [{ key: "base", label: `${svc.name}${size ? ` — ${size}` : ""}`, qty: 1, unitPrice: price, amount: price }, ...ex.map((e) => ({ key: e.slug, label: e.name, qty: e.qty, unitPrice: e.unitPrice, amount: e.qty * e.unitPrice }))] };
}
const vatOn = (amount) => ({ ...SERVICES.vat, amount: SERVICES.vat.enabled ? Math.round(amount * SERVICES.vat.rate) / 100 : 0 });
function bookingPrice(b) {
  const one = priceOne({ ...b, serviceSlug: b.service });
  const lines = [...one.lines, ...(b.supplies === "cleaniq" ? [{ key: "supplies", label: "Supplies & equipment", qty: 1, unitPrice: SERVICES.suppliesFee, amount: SERVICES.suppliesFee }] : [])];
  const subtotal = lines.reduce((t, l) => t + l.amount, 0);
  const vat = vatOn(subtotal);
  return { lines, subtotal, vat, total: subtotal + vat.amount, size: one.size, estHours: 4 };
}
function quotePrice(b) {
  const items = (b.items || []).map(priceOne);
  const supplies = b.supplies === "cleaniq" ? SERVICES.suppliesFee : 0;
  const subtotal = items.reduce((t, i) => t + i.subtotal, 0) + supplies;
  const discount = Math.min(subtotal, Number(b.discount) || 0);
  const vat = vatOn(subtotal - discount);
  return { items, supplies, subtotal, discount, vat, grandTotal: subtotal - discount + vat.amount };
}

function write(method, path, body = {}) {
  const clean = path.split("?")[0];
  if (clean === "/admin/bookings/price") return bookingPrice(body);
  if (clean === "/admin/quotes/price") return quotePrice(body);
  const seg = clean.split("/").filter(Boolean); // ["admin", "leads", "<id>", "notes"]
  if (clean === "/auth/admin/login") return { token: "demo", admin: ADMIN };
  if (clean === "/auth/admin/change-password") return { ok: true, admin: { ...ADMIN, mustChangePassword: false } };

  // Simple list pages: /admin/c/:type[/:id]
  if (seg[1] === "c") {
    const list = data[`/admin/c/${seg[2]}`] || (data[`/admin/c/${seg[2]}`] = { items: [], total: 0, counts: {} });
    const def = data["/admin/c/types"].types[seg[2]];
    if (method === "POST" && seg.length === 3) {
      const rec = { _id: id(), type: seg[2], data: body, title: String(body[def.titleField] ?? ""), status: def.statusField ? body[def.statusField] : "", createdBy: ADMIN.name, createdAt: now(), updatedAt: now() };
      list.items.unshift(rec);
      return { item: rec };
    }
    const rec = list.items.find((x) => x._id === seg[3]);
    if (seg[4] === "recipients") return { count: 128, sample: ["adaeze.okafor0@gmail.com", "tunde.adeyemi1@gmail.com"], max: 500 };
    if (seg[4] === "send" && rec) { rec.data.status = "Sent"; rec.status = "Sent"; rec.sent = { at: now(), count: (rec.sent?.count || 0) + 1 }; return { sent: 128, of: 128, item: rec }; }
    if (method === "PATCH" && rec) { Object.assign(rec.data, body); if (def.statusField && body[def.statusField]) rec.status = body[def.statusField]; rec.updatedAt = now(); return { item: rec }; }
    if (method === "DELETE") { list.items = list.items.filter((x) => x._id !== seg[3]); return { ok: true }; }
  }

  // Delete anything → remove from its list.
  if (method === "DELETE") {
    const f = findItem(seg[seg.length - 1]);
    if (f) f.all.items = f.all.items.filter((x) => x !== f.item);
    return { ok: true };
  }

  // Create in a list (leads, expenses, invoices, plans, blog, chat…).
  const base = `/${seg.slice(0, 2).join("/")}`;
  if (method === "POST" && seg.length === 2 && listFor(base)?.items) {
    const obj = { _id: id(), ...body, createdAt: now(), updatedAt: now(), createdBy: ADMIN.name };
    if (base === "/admin/invoices") {
      const lines = (body.lines || []).map((l) => ({ ...l, qty: Number(l.qty) || 1, amount: (Number(l.qty) || 1) * Number(l.unitPrice) }));
      Object.assign(obj, { invoiceNo: `INV-${Math.floor(600000 + Math.random() * 99999)}`, lines, total: lines.reduce((s, l) => s + l.amount, 0), status: "Unpaid", dueDate: body.dueDate || now().slice(0, 10), paystack: { url: "https://checkout.paystack.com/demo-link" }, sentAt: body.send === false ? undefined : now() });
      data[`/admin/invoices/${obj.invoiceNo}`] = { invoice: obj };
    }
    if (base === "/admin/subscriptions") Object.assign(obj, { ref: `PLAN-${Math.floor(300200 + Math.random() * 9999)}`, customerName: body.name, customerEmail: body.email, plan: { cleans: Number(body.cleans), per: body.per }, monthlyPrice: Number(body.monthlyPrice), status: "active", startedAt: now() });
    if (base === "/admin/support") Object.assign(obj, { ref: `CHAT-${Math.floor(400200 + Math.random() * 9999)}`, status: "open", messages: [{ from: "customer", text: body.message, at: now() }], lastMessageAt: now() });
    if (base === "/admin/blog") Object.assign(obj, { slug: String(body.title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-"), author: ADMIN.name, tags: String(body.tags || "").split(",").map((t) => t.trim()).filter(Boolean) });
    if (base === "/admin/leads") obj.notes = body.note ? [{ text: body.note, by: ADMIN.name, at: now() }] : [];
    if (base === "/admin/expenses") obj.amount = Number(body.amount);
    listFor(base).items.unshift(obj);
    if (base === "/admin/support") data[`/admin/support/${obj.ref}`] = { thread: obj };
    if (base === "/admin/blog") data[`/admin/blog/${obj._id}`] = { post: obj };
    return { ...wrap(obj), paymentLink: null };
  }

  // Changes to one thing: update the list item and its detail screen.
  const f = findItem(seg[2]);
  const dk = detailKey(clean);
  const detail = dk ? Object.values(data[dk]).find((v) => v && typeof v === "object" && !Array.isArray(v)) : null;
  const targets = [f?.item, detail].filter(Boolean);
  const action = seg[3];
  const set = (patch) => targets.forEach((t) => Object.assign(t, patch));
  if (method === "PATCH" && !action) set(body.stage && f?.item?.stage !== body.stage ? { ...body, notes: [...(f?.item?.notes || []), { text: `Moved from ${f?.item?.stage} to ${body.stage}`, by: ADMIN.name, at: now() }] } : body);
  if (action === "notes") set({ notes: [...(targets[0]?.notes || []), { text: body.text, by: ADMIN.name, at: now() }] });
  if (action === "mark-paid") set({ status: "Paid", paidAt: now(), method: body.method, payment: f?.item?.payment ? { ...f.item.payment, status: "Paid" } : undefined });
  if (action === "cancel") set({ status: "Cancelled" });
  if (action === "send") set({ sentAt: now() });
  if (["pause", "resume"].includes(action)) set({ status: action === "pause" ? "paused" : "active" });
  if (action === "status") set({ status: body.status });
  if (action === "reply" || action === "note") {
    const msg = { from: action === "reply" ? "admin" : "customer", text: body.text, by: ADMIN.name, at: now() };
    set({ messages: [...(targets[0]?.messages || []), msg], status: action === "reply" ? (body.close ? "closed" : "waiting") : "open", lastMessageAt: now() });
  }
  if (action === "assign") { const w = data["/admin/workers"].items.find((x) => x._id === body.workerId); set({ assignedWorker: w?._id || null, assignedWorkerName: w ? `${w.firstName} ${w.lastName}` : "", status: w ? "Assigned" : "Confirmed" }); }
  if (action === "visibility") set({ job: { ...(targets[0]?.job || {}), hidden: Boolean(body.hidden), visibleTo: [] } });
  const obj = targets[0] || { ...body };
  return { ok: true, ...wrap(obj), ...(dk ? data[dk] : {}), done: 1, sent: 1, emailed: true, result: "sent", draft: { title: "Keep your Lagos home dust-free this harmattan", excerpt: "Five simple habits.", body: "## Close windows early\n\nHarmattan winds pick up in the afternoon…", tags: ["harmattan", "tips"] } };
}

export async function mockRequest(path, { method = "GET", body } = {}) {
  await wait(method === "GET" ? 180 : 350);
  return structuredClone(method === "GET" ? get(path) : write(method, path, body));
}
