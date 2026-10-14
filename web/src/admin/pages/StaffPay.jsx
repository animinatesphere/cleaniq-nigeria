// Admin → Staff pay: Nigerian cleaners are paid MONTHLY on payday — salary, or per-job pay for jobs
// finished that month — plus bonuses / minus deductions. Pay by Paystack Transfer or mark paid.
import { useState } from "react";
import { BadgeCheck, Banknote, CalendarDays, ChevronLeft, ChevronRight, Plus, Send, Trash2, Users, Wallet } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Select, StatCard, dateTime, naira, shortDate, useAction } from "../ui";

const lagosMonth = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 7);
const shift = (m, d) => {
  const [y, mo] = m.split("-").map(Number);
  const x = new Date(Date.UTC(y, mo - 1 + d, 1));
  return x.toISOString().slice(0, 7);
};
const monthName = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default function StaffPay() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [month, setMonth] = useState(lagosMonth());
  const { data, error, loading, reload } = useLoad(`/admin/staff-pay/payroll?month=${month}`);
  const settings = useLoad("/admin/settings");
  const [view, setView] = useState(null);
  const [adj, setAdj] = useState({ amount: "", note: "" });
  const [pay, setPay] = useState(null);
  const [method, setMethod] = useState("paystack");

  const refresh = async (workerId) => {
    const r = await request(`/admin/staff-pay/payroll?month=${month}`);
    reload();
    if (workerId) setView(r.items.find((x) => x.workerId === workerId) || null);
  };
  const addAdj = async () => {
    await run(() => request(`/admin/staff-pay/payroll/${month}/adjustments`, { method: "POST", body: { workerId: view.workerId, amount: Number(adj.amount), note: adj.note } }), "Added");
    setAdj({ amount: "", note: "" });
    refresh(view.workerId);
  };
  const removeAdj = async (id) => {
    await run(() => request(`/admin/staff-pay/payroll/${month}/adjustments/${id}`, { method: "DELETE" }), "Removed");
    refresh(view.workerId);
  };
  const doPay = async () => {
    await run(() => request(`/admin/staff-pay/payroll/${month}/pay`, { method: "POST", body: { workerId: pay.workerId, method } }),
      method === "paystack" ? `Transfer of ${naira(pay.total)} sent to ${pay.name}` : `${pay.name} marked as paid`);
    setPay(null);
    setView(null);
    reload();
  };

  const statusOf = (r) => (r.payment?.status === "Paid" ? "Paid" : r.payment?.status === "Processing" ? "Sending" : r.payment?.status === "Failed" ? "Failed" : r.total > 0 ? "To pay" : "Nothing due");
  const columns = [
    { key: "name", label: "Cleaner", render: (r) => <span className="font-bold text-white">{r.name}</span> },
    { key: "type", label: "Pay type", render: (r) => (r.payType === "salary" ? "Monthly salary" : "Per job") },
    { key: "jobs", label: "Jobs done", render: (r) => r.jobsCount },
    { key: "base", label: "Salary / jobs", render: (r) => naira(r.payType === "salary" ? r.salary : r.jobsAmount) },
    { key: "adj", label: "Bonus / deduction", render: (r) => (r.adjustmentsTotal ? <span className={r.adjustmentsTotal > 0 ? "text-emerald-300" : "text-rose-300"}>{r.adjustmentsTotal > 0 ? "+" : ""}{naira(r.adjustmentsTotal)}</span> : "—") },
    { key: "total", label: "Total", render: (r) => <span className="font-black text-white">{naira(r.total)}</span> },
    { key: "bank", label: "Bank", render: (r) => r.bank || <span className="text-amber-300">No bank details</span> },
    { key: "status", label: "Status", render: (r) => <Badge tone={{ Paid: "Completed", Sending: "Processing", Failed: "failed", "To pay": "Pending" }[statusOf(r)]}>{statusOf(r)}</Badge> },
  ];

  const payday = settings.data?.payroll?.payday || 28;
  return (
    <>
      <PageHeader title="Staff pay" subtitle={`Cleaners are paid once a month on payday (the ${payday}${[1, 21].includes(payday) ? "st" : [2, 22].includes(payday) ? "nd" : [3, 23].includes(payday) ? "rd" : "th"}). Salary or per-job pay, plus bonuses and deductions.`}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth((m) => shift(m, -1))} />
            <span className="min-w-36 text-center font-bold text-white">{monthName(month)}</span>
            <Button variant="secondary" icon={ChevronRight} aria-label="Next month" onClick={() => setMonth((m) => shift(m, 1))} disabled={month >= lagosMonth()} />
          </div>
        )} />

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total pay" value={naira(data.totals.total)} hint={monthName(month)} icon={Wallet} />
            <StatCard label="Paid so far" value={naira(data.totals.paid)} icon={BadgeCheck} tone="sky" />
            <StatCard label="Cleaners" value={data.totals.cleaners} icon={Users} tone="amber" />
            <StatCard label="Jobs done" value={data.totals.jobs} icon={CalendarDays} tone="rose" />
          </div>
          <DataTable columns={columns} rows={data.items} rowKey={(r) => r.workerId} onRowClick={setView}
            empty={<Empty title="No cleaners yet" text="Add cleaners under People → Cleaners and set how they're paid." />} />
        </>
      )}

      <Modal open={Boolean(view)} onClose={() => setView(null)} wide title={view ? `${view.name} — ${monthName(month)}` : ""}
        footer={view && can("owner") && !["Paid", "Processing"].includes(view.payment?.status) && view.total > 0 && (
          <Button icon={Send} onClick={() => { setMethod(view.hasBank ? "paystack" : "cash"); setPay(view); }}>Pay {naira(view.total)}</Button>
        )}>
        {view && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card><p className="text-xs font-bold text-white/40 uppercase">{view.payType === "salary" ? "Monthly salary" : `Jobs (${view.jobsCount})`}</p><p className="mt-1 text-lg font-black text-white">{naira(view.payType === "salary" ? view.salary : view.jobsAmount)}</p></Card>
              <Card><p className="text-xs font-bold text-white/40 uppercase">Bonus / deduction</p><p className="mt-1 text-lg font-black text-white">{naira(view.adjustmentsTotal)}</p></Card>
              <Card><p className="text-xs font-bold text-white/40 uppercase">Total</p><p className="mt-1 text-lg font-black text-emerald-300">{naira(view.total)}</p></Card>
            </div>
            {view.payment && (
              <p className="rounded-xl bg-white/[0.04] p-3 text-white/70">
                Payment: <Badge>{view.payment.status}</Badge> {naira(view.payment.amount)} by {view.payment.method}{view.payment.paidAt ? ` on ${dateTime(view.payment.paidAt)}` : ""}{view.payment.failureReason ? ` — ${view.payment.failureReason}` : ""}
              </p>
            )}
            <div>
              <p className="mb-2 text-xs font-bold tracking-wide text-white/40 uppercase">Bonuses & deductions</p>
              {view.adjustments.length ? (
                <ul className="space-y-1.5">
                  {view.adjustments.map((a) => (
                    <li key={a._id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                      <span><span className={a.amount > 0 ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>{a.amount > 0 ? "+" : ""}{naira(a.amount)}</span> · {a.note} <span className="text-white/40">({a.by})</span></span>
                      {!view.payment?.status || view.payment.status === "Failed" ? <button type="button" aria-label="Remove" onClick={() => removeAdj(a._id)} className="text-white/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-white/50">None this month.</p>}
              {(!view.payment?.status || view.payment.status === "Failed") && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                  <Input id="adj-amount" type="number" label="Amount (₦)" placeholder="e.g. 5000 or -2000" value={adj.amount} onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value }))} />
                  <Input id="adj-note" label="What for" placeholder="e.g. Bonus for great reviews" value={adj.note} onChange={(e) => setAdj((a) => ({ ...a, note: e.target.value }))} />
                  <Button icon={Plus} loading={busy} onClick={addAdj}>Add</Button>
                </div>
              )}
            </div>
            {view.jobs.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold tracking-wide text-white/40 uppercase">Jobs this month</p>
                <ul className="space-y-1">
                  {view.jobs.map((j) => (
                    <li key={j.bookingId} className="flex justify-between gap-3 text-white/75">
                      <span>{j.bookingId} · {j.service} · {shortDate(j.finishedAt)}</span>
                      {view.payType === "perJob" && <span className="font-bold">{naira(j.amount)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal open={Boolean(pay)} onClose={() => setPay(null)} onConfirm={doPay} loading={busy}
        title={pay ? `Pay ${pay.name} ${naira(pay.total)}?` : ""} confirmLabel={method === "paystack" ? "Send transfer" : "Mark as paid"}>
        {pay && (
          <div className="space-y-3">
            <Select id="pay-method" label="How" value={method} onChange={(e) => setMethod(e.target.value)}
              options={[...(pay.hasBank ? [{ value: "paystack", label: `Paystack transfer to ${pay.bank}` }] : []), { value: "bank transfer", label: "I paid by bank transfer myself" }, { value: "cash", label: "I paid in cash" }]} />
            <p className="flex items-center gap-2 text-xs text-white/50"><Banknote className="h-4 w-4" /> Each cleaner can only be paid once per month.</p>
          </div>
        )}
      </ConfirmModal>
    </>
  );
}
