// Admin → Invoices (pay-after, weekly bills, monthly plans, manual) and Payment link (mode="links").
import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, Copy, Link2, Mail, Plus, Receipt, Settings2, Trash2, Wallet } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import {
  Badge, Button, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SearchBox, Select,
  StatCard, TextArea, Toggle, dateTime, naira, shortDate, useAction, useToast,
} from "../ui";

export const KIND_LABEL = { payAfter: "Pay after clean", weekly: "Weekly bill", subscription: "Monthly plan", link: "Payment link", manual: "Invoice" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);

function statusOf(inv) {
  return inv.status === "Unpaid" && inv.dueDate && inv.dueDate < today() ? "Overdue" : inv.status;
}
const STATUS_TONE = { Unpaid: "Pending", Overdue: "Cancelled", Paid: "Paid", Cancelled: "Expired" };

export default function Invoices({ mode = "invoices" }) {
  const links = mode === "links";
  const { request, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [run, busy] = useAction();
  const [tab, setTab] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState(false);
  const [markPaid, setMarkPaid] = useState(null);
  const [cancel, setCancel] = useState(null);
  const kindQuery = links ? "&kinds=link" : kind ? `&kind=${kind}` : "";
  const { data, error, loading, reload } = useLoad(`/admin/invoices?page=${page}&limit=25${tab ? `&status=${tab}` : ""}${kindQuery}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const managers = can("owner", "manager");

  const openInvoice = async (no) => setView((await request(`/admin/invoices/${no}`)).invoice);
  const copy = (url) => navigator.clipboard?.writeText(url).then(() => toast("Payment link copied"), () => toast("Couldn't copy — select the link instead", "error"));
  const after = (inv) => { if (inv) setView((v) => (v ? { ...v, ...inv } : v)); reload(); };

  const counts = data?.counts || {};
  const columns = [
    { key: "no", label: links ? "Link" : "Invoice", render: (x) => <span className="font-bold text-white">{x.invoiceNo}</span> },
    { key: "customer", label: "Customer", render: (x) => <span>{x.customer?.name}<span className="block text-xs text-white/45">{x.customer?.email}</span></span> },
    ...(links ? [{ key: "for", label: "For", render: (x) => x.lines?.[0]?.description }] : [{ key: "kind", label: "Type", render: (x) => KIND_LABEL[x.kind] }]),
    { key: "total", label: "Amount", render: (x) => <span className="font-bold">{naira(x.total)}</span> },
    { key: "due", label: "Due", render: (x) => shortDate(x.dueDate) },
    { key: "status", label: "Status", render: (x) => <Badge tone={STATUS_TONE[statusOf(x)]}>{statusOf(x)}</Badge> },
    ...(links ? [{ key: "copy", label: "", render: (x) => x.status === "Unpaid" && x.paystack?.url && <Button size="sm" variant="secondary" icon={Copy} onClick={(e) => { e.stopPropagation(); copy(x.paystack.url); }}>Copy</Button> }] : []),
  ];

  return (
    <>
      <PageHeader
        title={links ? "Payment link" : "Invoices"}
        subtitle={links
          ? "Make a Paystack link for any amount — send it by email, or copy it into WhatsApp."
          : "Pay-after cleans are billed the day after, weekly customers every week, monthly plans each month. Unpaid invoices get reminders automatically."}
        actions={<>
          {!links && managers && <Button variant="secondary" icon={Settings2} onClick={() => setSettings(true)}>Billing settings</Button>}
          <Button icon={links ? Link2 : Plus} onClick={() => setCreating(true)}>{links ? "New payment link" : "New invoice"}</Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waiting for payment" value={naira(counts.Unpaid?.value)} hint={`${counts.Unpaid?.count || 0} unpaid`} icon={Wallet} tone="amber" onClick={() => { setTab("Unpaid"); setPage(1); }} />
        <StatCard label="Overdue" value={naira(counts.Overdue?.value)} hint={`${counts.Overdue?.count || 0} past the due date`} icon={AlertTriangle} tone="rose" onClick={() => { setTab("Overdue"); setPage(1); }} />
        <StatCard label="Paid" value={naira(counts.Paid?.value)} hint={`${counts.Paid?.count || 0} paid`} icon={CheckCircle2} tone="emerald" onClick={() => { setTab("Paid"); setPage(1); }} />
        <StatCard label="Cancelled" value={counts.Cancelled?.count || 0} hint={naira(counts.Cancelled?.value)} icon={Ban} tone="sky" onClick={() => { setTab("Cancelled"); setPage(1); }} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {["", "Unpaid", "Overdue", "Paid", "Cancelled"].map((s) => (
            <button key={s || "all"} type="button" onClick={() => { setTab(s); setPage(1); }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${tab === s ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>{s || "All"}</button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!links && <Select id="inv-kind" aria-label="Type" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} options={[{ value: "", label: "All types" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]} />}
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email, number…" />
        </div>
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(x) => x.invoiceNo} onRowClick={(x) => openInvoice(x.invoiceNo)}
            empty={<Empty title={links ? "No payment links yet" : "No invoices yet"} text={links ? "Make a link for a deposit, an extra service or anything else." : "Invoices appear here when pay-after cleans are completed, on the weekly bill, and for monthly plans."}
              action={<Button icon={links ? Link2 : Plus} onClick={() => setCreating(true)}>{links ? "New payment link" : "New invoice"}</Button>} />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}

      {/* ── One invoice ── */}
      <Modal open={Boolean(view)} onClose={() => setView(null)} wide title={view ? `${KIND_LABEL[view.kind]} ${view.invoiceNo}` : ""}
        footer={view && view.status === "Unpaid" && (
          <>
            {managers && <Button variant="ghost" icon={Trash2} onClick={() => setCancel(view)}>Cancel</Button>}
            {managers && <Button variant="secondary" icon={CheckCircle2} onClick={() => setMarkPaid({ inv: view, method: "Bank transfer", note: "" })}>Mark paid</Button>}
            <Button icon={Mail} loading={busy} onClick={() => run(() => request(`/admin/invoices/${view.invoiceNo}/send`, { method: "POST" }), view.sentAt ? "Reminder emailed" : "Invoice emailed").then((r) => after(r.invoice)).catch(() => {})}>
              {view.sentAt ? "Send reminder" : "Email it"}
            </Button>
          </>
        )}>
        {view && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATUS_TONE[statusOf(view)]}>{statusOf(view)}</Badge>
              <span className="text-white/60">
                Made {dateTime(view.createdAt)}{view.createdBy ? ` by ${view.createdBy === "system" ? "Cleaniq (automatic)" : view.createdBy}` : ""}
                {view.sentAt ? ` · emailed ${dateTime(view.sentAt)}` : " · not emailed yet"}{view.reminders ? ` · ${view.reminders} reminder${view.reminders > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[["Customer", view.customer?.name], ["Email", view.customer?.email], ["Phone", view.customer?.phone], ["Due", shortDate(view.dueDate)],
                ["Period", view.period?.from ? `${shortDate(view.period.from)} – ${shortDate(view.period.to)}` : view.period?.month],
                ["Paid", view.paidAt ? `${dateTime(view.paidAt)} · ${view.method}` : ""]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 break-words text-white/85">{v}</dd></div>
              ))}
            </dl>
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <dl className="space-y-2">
                {view.lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <dt className="text-white/80">
                      {l.bookingId ? <button type="button" className="text-left underline decoration-white/20 hover:text-emerald-300" onClick={() => navigate(`/admin/bookings/${l.bookingId}`)}>{l.description}</button> : l.description}
                      {l.qty > 1 ? ` × ${l.qty}` : ""}
                    </dt>
                    <dd className="font-bold text-white">{naira(l.amount)}</dd>
                  </div>
                ))}
                {view.vat?.enabled && <div className="flex justify-between text-white/60"><dt>{view.vat.label} ({view.vat.rate}%)</dt><dd>{naira(view.vat.amount)}</dd></div>}
                <div className="flex justify-between border-t border-white/10 pt-2 text-base"><dt className="font-bold text-white">Total</dt><dd className="font-black text-emerald-300">{naira(view.total)}</dd></div>
              </dl>
            </div>
            {view.status === "Unpaid" && view.paystack?.url && (
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-200">{view.paystack.url}</p>
                <Button size="sm" variant="secondary" icon={Copy} onClick={() => copy(view.paystack.url)}>Copy link</Button>
              </div>
            )}
            {view.note && <p className="whitespace-pre-wrap text-white/60">{view.note}</p>}
          </div>
        )}
      </Modal>

      <NewInvoice open={creating} links={links} onClose={() => setCreating(false)} onDone={(inv) => { setCreating(false); reload(); setView(inv); }} />
      {managers && <BillingSettings open={settings} onClose={() => setSettings(false)} onRan={reload} />}

      <Modal open={Boolean(markPaid)} onClose={() => setMarkPaid(null)} title="Mark as paid"
        footer={<><Button variant="ghost" onClick={() => setMarkPaid(null)}>Back</Button><Button icon={CheckCircle2} loading={busy}
          onClick={() => run(() => request(`/admin/invoices/${markPaid.inv.invoiceNo}/mark-paid`, { method: "POST", body: { method: markPaid.method, note: markPaid.note } }), "Marked as paid").then((r) => { setMarkPaid(null); after(r.invoice); }).catch(() => {})}>Mark paid</Button></>}>
        {markPaid && (
          <div className="space-y-4">
            <p className="text-sm text-white/70">For money received outside Paystack. {naira(markPaid.inv.total)} from {markPaid.inv.customer?.name}.</p>
            <Select id="mp-method" label="How was it paid?" options={["Bank transfer", "Cash", "POS"]} value={markPaid.method} onChange={(e) => setMarkPaid({ ...markPaid, method: e.target.value })} />
            <Input id="mp-note" label="Note (optional)" placeholder="e.g. transfer from GTBank, 12 Oct" value={markPaid.note} onChange={(e) => setMarkPaid({ ...markPaid, note: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmModal open={Boolean(cancel)} onClose={() => setCancel(null)} danger loading={busy} title="Cancel this invoice?" confirmLabel="Cancel invoice"
        text="The customer can no longer pay it. Any cleans on it can be billed again."
        onConfirm={() => run(() => request(`/admin/invoices/${cancel.invoiceNo}/cancel`, { method: "POST" }), "Invoice cancelled").then((r) => { setCancel(null); after(r.invoice); }).catch(() => {})} />
    </>
  );
}

function NewInvoice({ open, links, onClose, onDone }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const empty = { name: "", email: "", phone: "", lines: [{ description: "", qty: 1, unitPrice: "" }], dueDate: "", addVat: false, note: "", send: true };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setLine = (i, k, v) => setF((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const total = f.lines.reduce((s, l) => s + (Number(l.qty) || 1) * (Number(l.unitPrice) || 0), 0);

  async function save() {
    setErrors({});
    try {
      const r = await run(() => request("/admin/invoices", { method: "POST", body: {
        kind: links ? "link" : "manual", customer: { name: f.name, email: f.email, phone: f.phone },
        lines: f.lines.map((l) => ({ ...l, unitPrice: Number(l.unitPrice) })), dueDate: f.dueDate || undefined, addVat: f.addVat, note: f.note, send: f.send,
      } }), f.send ? "Made and emailed" : "Made — copy the link to share it");
      setF(empty);
      onDone(r.invoice);
    } catch (e) { setErrors(e.details || {}); }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={links ? "New payment link" : "New invoice"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon={links ? Link2 : Receipt} loading={busy} onClick={save}>{links ? "Make link" : "Make invoice"} · {naira(total)}</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input id="ni-name" label="Customer name *" error={errors.name} value={f.name} onChange={(e) => set("name", e.target.value)} />
          <Input id="ni-email" label="Email *" type="email" error={errors.email} value={f.email} onChange={(e) => set("email", e.target.value)} />
          <Input id="ni-phone" label="Phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">{links ? "What it's for" : "Items"}</p>
          <div className="space-y-2">
            {f.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_5rem_9rem_auto]">
                <Input id={`ni-d${i}`} aria-label="Description" placeholder={links ? "e.g. Deposit for post-construction clean" : "Description"} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} className="col-span-2 sm:col-span-1" />
                {!links && <Input id={`ni-q${i}`} aria-label="Quantity" type="number" min="1" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />}
                <Input id={`ni-p${i}`} aria-label="Amount in naira" type="number" min="0" placeholder="₦ amount" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value)} className={links ? "col-span-2 sm:col-span-2" : ""} />
                {!links && f.lines.length > 1 && <Button variant="ghost" icon={Trash2} aria-label="Remove line" onClick={() => setF((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} />}
              </div>
            ))}
          </div>
          {errors.lines && <p role="alert" className="mt-1 text-xs font-semibold text-rose-300">{errors.lines}</p>}
          {!links && <Button className="mt-2" size="sm" variant="secondary" icon={Plus} onClick={() => setF((x) => ({ ...x, lines: [...x.lines, { description: "", qty: 1, unitPrice: "" }] }))}>Add line</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="ni-due" label="Due date" type="date" error={errors.dueDate} hint={links ? "Leave empty for today" : "Leave empty for 7 days from today"} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          <TextArea id="ni-note" label="Note (only you see it)" value={f.note} onChange={(e) => set("note", e.target.value)} rows={2} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          <Toggle id="ni-vat" label="Add VAT (from Settings)" checked={f.addVat} onChange={(v) => set("addVat", v)} />
          <Toggle id="ni-send" label="Email it to the customer now" checked={f.send} onChange={(v) => set("send", v)} />
        </div>
      </div>
    </Modal>
  );
}

function BillingSettings({ open, onClose, onRan }) {
  const { request } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();
  const { data, reload } = useLoad(open ? "/admin/invoices/billing-settings" : null);
  const [f, setF] = useState(null);
  const b = f || data?.billing;
  const save = () => run(() => request("/admin/invoices/billing-settings", { method: "PUT", body: b }), "Billing settings saved").then(() => { setF(null); reload(); onClose(); }).catch(() => {});
  const runJob = (job, label) => run(() => request(`/admin/invoices/run/${job}`, { method: "POST" })).then((r) => { toast(`${label}: ${typeof r.done === "object" ? JSON.stringify(r.done) : r.done}`); onRan(); }).catch(() => {});
  return (
    <Modal open={open} onClose={onClose} title="Billing settings" footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button loading={busy} onClick={save} disabled={!b}>Save</Button></>}>
      {!b ? <Loading /> : (
        <div className="space-y-5">
          <Select id="bs-days" label="Pay-after cleans are due" value={String(b.payAfterDays)} onChange={(e) => setF({ ...b, payAfterDays: Number(e.target.value) })}
            options={[0, 1, 2, 3, 5, 7].map((n) => ({ value: String(n), label: n === 0 ? "The same day" : n === 1 ? "The day after the clean" : `${n} days after the clean` }))} />
          <Select id="bs-week" label="Weekly bills go out every" value={String(b.weeklyBillingDay)} onChange={(e) => setF({ ...b, weeklyBillingDay: Number(e.target.value) })}
            options={DAYS.map((d, i) => ({ value: String(i), label: `${d} (for the week before)` }))} />
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-white"><CalendarClock className="h-4 w-4 text-emerald-300" /> Run now</p>
            <p className="mt-1 text-xs text-white/50">These run by themselves every hour. Use these only if you need them straight away.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={busy} onClick={() => runJob("subscriptions", "Monthly plans billed")}>Bill monthly plans</Button>
              <Button size="sm" variant="secondary" loading={busy} onClick={() => runJob("weekly", "Weekly bills")}>Weekly bills</Button>
              <Button size="sm" variant="secondary" loading={busy} onClick={() => runJob("reminders", "Reminders sent")}>Overdue reminders</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
