// Admin → Monthly plans: regular cleans for a fixed monthly price, invoiced in advance each month.
import { useState } from "react";
import { AlertTriangle, CalendarCheck, Pause, Play, Plus, Receipt, Repeat, Users, XCircle } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import {
  Badge, Button, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SearchBox, Select,
  StatCard, dateTime, naira, shortDate, useAction,
} from "../ui";
import { KIND_LABEL } from "./Invoices";

const LABEL = { active: "Active", payment_due: "Payment due", paused: "Paused", cancelled: "Cancelled" };
const TONE = { active: "Paid", payment_due: "Pending", paused: "Expired", cancelled: "Cancelled" };
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);

export default function Subscriptions() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null); // { subscription, invoices }
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const { data, error, loading, reload } = useLoad(`/admin/subscriptions?page=${page}&limit=25${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const managers = can("owner", "manager");
  const c = data?.counts || {};

  const open = async (id) => setView(await request(`/admin/subscriptions/${id}`));
  const act = (action, msg) => run(() => request(`/admin/subscriptions/${view.subscription._id}/${action}`, { method: "POST" }), msg).then(() => { setConfirm(null); open(view.subscription._id); reload(); }).catch(() => {});

  const columns = [
    { key: "c", label: "Customer", render: (s) => <span><span className="font-bold text-white">{s.customerName}</span><span className="block text-xs text-white/45">{s.ref}</span></span> },
    { key: "plan", label: "Plan", render: (s) => `${s.service || "Cleaning"} · ${s.plan?.cleans}× per ${s.plan?.per}` },
    { key: "area", label: "Area", render: (s) => s.area || "—" },
    { key: "price", label: "Monthly", render: (s) => <span className="font-bold">{naira(s.monthlyPrice)}</span> },
    { key: "next", label: "Next bill", render: (s) => (s.status === "cancelled" ? "—" : shortDate(s.nextBillingDate)) },
    { key: "cleaner", label: "Regular cleaner", render: (s) => (s.regularWorker ? `${s.regularWorker.firstName} ${s.regularWorker.lastName || ""}` : "—") },
    { key: "status", label: "Status", render: (s) => <Badge tone={TONE[s.status]}>{LABEL[s.status]}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Monthly plans" subtitle="Customers on a regular cleaning plan pay a fixed price every month, in advance."
        actions={managers && <Button icon={Plus} onClick={() => setForm({})}>New plan</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Monthly income from plans" value={naira((c.active?.value || 0) + (c.payment_due?.value || 0))} hint={`${(c.active?.count || 0) + (c.payment_due?.count || 0)} plans running`} icon={Repeat} tone="emerald" />
        <StatCard label="Active" value={c.active?.count || 0} hint="Paid for this month" icon={CalendarCheck} tone="sky" onClick={() => { setStatus("active"); setPage(1); }} />
        <StatCard label="Payment due" value={c.payment_due?.count || 0} hint={naira(c.payment_due?.value)} icon={AlertTriangle} tone="amber" onClick={() => { setStatus("payment_due"); setPage(1); }} />
        <StatCard label="Paused / cancelled" value={(c.paused?.count || 0) + (c.cancelled?.count || 0)} icon={Users} tone="rose" onClick={() => { setStatus("paused"); setPage(1); }} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["", "active", "payment_due", "paused", "cancelled"].map((s) => (
            <button key={s || "all"} type="button" onClick={() => { setStatus(s); setPage(1); }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${status === s ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>{s ? LABEL[s] : "All"}</button>
          ))}
        </div>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search customer, area, plan…" />
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} onRowClick={(s) => open(s._id)}
            empty={<Empty title="No monthly plans yet" text="Put a regular customer on a plan — e.g. 2 cleans a week for ₦150,000 a month." action={managers && <Button icon={Plus} onClick={() => setForm({})}>New plan</Button>} />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}

      <Modal open={Boolean(view)} onClose={() => setView(null)} wide title={view ? `${view.subscription.customerName} — ${view.subscription.ref}` : ""}
        footer={view && managers && view.subscription.status !== "cancelled" && (
          <>
            <Button variant="ghost" icon={XCircle} onClick={() => setConfirm("cancel")}>Cancel plan</Button>
            <Button variant="secondary" onClick={() => setForm(view.subscription)}>Edit</Button>
            {view.subscription.status === "paused"
              ? <Button variant="secondary" icon={Play} loading={busy} onClick={() => act("resume", "Plan resumed")}>Resume</Button>
              : <Button variant="secondary" icon={Pause} loading={busy} onClick={() => act("pause", "Plan paused — no bills while paused")}>Pause</Button>}
            {view.subscription.status !== "paused" && <Button icon={Receipt} loading={busy} onClick={() => setConfirm("bill")}>Bill next month now</Button>}
          </>
        )}>
        {view && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={TONE[view.subscription.status]}>{LABEL[view.subscription.status]}</Badge>
              <span className="text-white/60">Started {dateTime(view.subscription.startedAt)}{view.subscription.cancelledAt ? ` · cancelled ${dateTime(view.subscription.cancelledAt)}` : ""}</span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[["Plan", `${view.subscription.service} · ${view.subscription.plan?.cleans}× per ${view.subscription.plan?.per}`], ["Monthly price", naira(view.subscription.monthlyPrice)],
                ["Next bill", view.subscription.status === "cancelled" ? "—" : shortDate(view.subscription.nextBillingDate)], ["Email", view.subscription.customerEmail], ["Phone", view.subscription.customerPhone],
                ["Area", view.subscription.area], ["Address", view.subscription.address],
                ["Regular cleaner", view.subscription.regularWorker ? `${view.subscription.regularWorker.firstName} ${view.subscription.regularWorker.lastName || ""}` : "Not set"]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 break-words text-white/85">{v}</dd></div>)}
            </dl>
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-white/50 uppercase">Bills</h3>
              {view.invoices.length ? (
                <ul className="divide-y divide-white/5 rounded-2xl bg-white/[0.04]">
                  {view.invoices.map((i) => (
                    <li key={i.invoiceNo} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span><span className="font-bold text-white">{i.period?.month || shortDate(i.dueDate)}</span><span className="block text-xs text-white/45">{i.invoiceNo} · {KIND_LABEL[i.kind]}</span></span>
                      <span className="flex items-center gap-3"><span className="font-bold">{naira(i.total)}</span><Badge tone={i.status === "Unpaid" ? "Pending" : i.status}>{i.status}</Badge></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-white/50">No bills yet.</p>}
            </div>
          </div>
        )}
      </Modal>

      <PlanForm initial={form} onClose={() => setForm(null)} onSaved={(s) => { setForm(null); reload(); if (view) open(s._id); }} />

      <ConfirmModal open={confirm === "cancel"} onClose={() => setConfirm(null)} danger loading={busy} title="Cancel this plan?" confirmLabel="Cancel plan"
        text="No more monthly bills. Bills already sent stay as they are." onConfirm={() => act("cancel", "Plan cancelled")} />
      <ConfirmModal open={confirm === "bill"} onClose={() => setConfirm(null)} loading={busy} title="Bill the next month now?" confirmLabel="Send the bill"
        text={view ? `${view.subscription.customerName} gets an invoice for ${naira(view.subscription.monthlyPrice)} with a Paystack link. Each month is only ever billed once.` : ""}
        onConfirm={() => act("bill", "Bill sent")} />
    </>
  );
}

function PlanForm({ initial, onClose, onSaved }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const editing = Boolean(initial?._id);
  const services = useLoad(initial ? "/admin/services" : null);
  const workers = useLoad(initial ? "/admin/workers?status=active&limit=100" : null);
  const [f, setF] = useState(null);
  const [errors, setErrors] = useState({});
  const base = initial && {
    name: initial.customerName || "", email: initial.customerEmail || "", phone: initial.customerPhone || "", area: initial.area || "", address: initial.address || "",
    service: initial.service || "", cleans: initial.plan?.cleans || 1, per: initial.plan?.per || "week", monthlyPrice: initial.monthlyPrice || "",
    nextBillingDate: initial.nextBillingDate || today(), regularWorker: initial.regularWorker?._id || initial.regularWorker || "",
  };
  const v = f || base;
  if (!initial) return null;
  const set = (k, val) => setF({ ...v, [k]: val });
  const perMonth = v.per === "week" ? Math.round(Number(v.cleans) * 4.33) : Number(v.cleans);

  async function save() {
    setErrors({});
    try {
      const body = editing
        ? { service: v.service, cleans: v.cleans, per: v.per, monthlyPrice: v.monthlyPrice, nextBillingDate: v.nextBillingDate, area: v.area, address: v.address, regularWorker: v.regularWorker || null }
        : v;
      const r = await run(() => request(editing ? `/admin/subscriptions/${initial._id}` : "/admin/subscriptions", { method: editing ? "PATCH" : "POST", body }), editing ? "Plan updated" : "Plan created");
      setF(null);
      onSaved(r.subscription);
    } catch (e) { setErrors(e.details || {}); }
  }
  const close = () => { setF(null); onClose(); };

  return (
    <Modal open onClose={close} wide title={editing ? "Edit plan" : "New monthly plan"}
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button loading={busy} onClick={save}>{editing ? "Save" : "Create plan"}</Button></>}>
      <div className="space-y-5">
        {!editing && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Input id="pl-name" label="Customer name *" error={errors.name} value={v.name} onChange={(e) => set("name", e.target.value)} />
            <Input id="pl-email" label="Email *" type="email" error={errors.email} value={v.email} onChange={(e) => set("email", e.target.value)} />
            <Input id="pl-phone" label="Phone" type="tel" error={errors.phone} value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select id="pl-service" label="Service *" error={errors.service} placeholder="Choose…" value={v.service} onChange={(e) => set("service", e.target.value)}
            options={(services.data?.items || services.data?.services || []).map((s) => s.name)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="pl-cleans" label="Cleans *" type="number" min="1" max="31" error={errors.cleans} value={v.cleans} onChange={(e) => set("cleans", e.target.value)} />
            <Select id="pl-per" label="Per" value={v.per} onChange={(e) => set("per", e.target.value)} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          </div>
          <Input id="pl-price" label="Monthly price (₦) *" type="number" min="0" error={errors.monthlyPrice} hint={perMonth && v.monthlyPrice ? `About ${perMonth} cleans a month · ≈ ${naira(Math.round(Number(v.monthlyPrice) / perMonth))} per clean` : "Priced by service and property size"} value={v.monthlyPrice} onChange={(e) => set("monthlyPrice", e.target.value)} />
          <Input id="pl-next" label={editing ? "Next bill date *" : "First bill date *"} type="date" error={errors.nextBillingDate} hint={!editing ? "If it's today, the first bill goes out straight away" : undefined} value={v.nextBillingDate} onChange={(e) => set("nextBillingDate", e.target.value)} />
          <Input id="pl-area" label="Area" placeholder="e.g. Lekki Phase 1" value={v.area} onChange={(e) => set("area", e.target.value)} />
          <Input id="pl-address" label="Address" value={v.address} onChange={(e) => set("address", e.target.value)} />
          <Select id="pl-worker" label="Regular cleaner" placeholder="Not set" error={errors.regularWorker} value={v.regularWorker} onChange={(e) => set("regularWorker", e.target.value)}
            options={(workers.data?.items || []).map((w) => ({ value: w._id, label: `${w.firstName} ${w.lastName || ""}` }))} />
        </div>
      </div>
    </Modal>
  );
}
