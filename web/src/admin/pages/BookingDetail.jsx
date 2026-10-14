// One booking: details, status, cleaner, schedule, notes, emails, payment (take payment / refund), history.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Ban, CalendarClock, Copy, CreditCard, Mail, MessageCircle, RotateCcw, Trash2, UserCheck } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, ConfirmModal, ErrorBox, Input, Loading, Modal, PageHeader, Select, TextArea, Toggle, dateTime, naira, shortDate, time12, useAction, useToast } from "../ui";

const NEXT = {
  Pending: ["Confirmed"],
  Confirmed: ["In Progress", "Completed"],
  Assigned: ["In Progress", "Completed"],
  "In Progress": ["Completed"],
  Completed: [],
  Cancelled: [],
};
const TIMES = [];
for (let m = 8 * 60; m <= 18 * 60; m += 30) TIMES.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

function Row({ label, children }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2 text-sm last:border-0">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-right font-semibold text-white">{children}</dd>
    </div>
  );
}

export default function BookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { request, can } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad(`/admin/bookings/${bookingId}`);
  const workers = useLoad("/admin/workers?status=active&limit=100");
  const [modal, setModal] = useState(null); // assign | schedule | cancel | refund | paid | link | delete | pay
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const b = data.booking;
  const close = () => setModal(null);
  const act = async (fn, msg) => {
    await run(fn, msg);
    close();
    reload();
  };
  const post = (path, body, method = "POST") => request(`/admin/bookings/${b.bookingId}${path}`, { method, body: body || {} });
  const r = b.details?.rooms || {};
  const isPaid = b.payment?.status === "Paid";

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Link copied");
    } catch {
      toast("Couldn't copy — select the link and copy it", "error");
    }
  };

  return (
    <>
      <Link to="/admin/bookings" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>
      <PageHeader
        title={`Booking ${b.bookingId}`}
        subtitle={`${b.customer?.firstName} ${b.customer?.lastName} · ${b.service} · created ${dateTime(b.createdAt)} (${b.source})`}
        actions={
          <>
            <Badge>{b.status}</Badge>
            <Badge>{b.payment?.status}</Badge>
          </>
        }
      />

      {/* Actions */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {NEXT[b.status].map((s) => (
            <Button key={s} size="sm" loading={busy} onClick={() => act(() => post("/status", { status: s }, "PATCH"), `Marked ${s}`)}>
              Mark {s}
            </Button>
          ))}
          {!["Completed", "Cancelled"].includes(b.status) && (
            <>
              <Button size="sm" variant="secondary" icon={UserCheck} onClick={() => { setForm({ workerId: b.assignedWorker?._id || "" }); setModal("assign"); }}>
                {b.assignedWorker ? "Change cleaner" : "Assign cleaner"}
              </Button>
              <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => { setForm({ date: b.schedule?.date, time: b.schedule?.time }); setModal("schedule"); }}>
                Reschedule
              </Button>
            </>
          )}
          {b.payment?.status === "Pending" && b.status !== "Cancelled" && (
            <Button size="sm" variant="secondary" icon={CreditCard} onClick={() => setModal("pay")}>
              Take payment
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={Mail} onClick={() => setModal("resend")}>
            Resend email
          </Button>
          {can("owner", "manager") && isPaid && b.payment?.reference && !b.payment?.offline?.method && (
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => { setForm({ amount: "", reason: "" }); setModal("refund"); }}>
              Refund
            </Button>
          )}
          {can("owner", "manager") && !["Completed", "Cancelled"].includes(b.status) && (
            <Button size="sm" variant="danger" icon={Ban} onClick={() => { setForm({ reason: "", refund: isPaid && !b.payment?.offline?.method, notifyCustomer: true }); setModal("cancel"); }}>
              Cancel
            </Button>
          )}
          {can("owner") && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setModal("delete")}>
              Delete
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-2 font-extrabold text-white">Job</h2>
            <dl>
              <Row label="When">{`${shortDate(b.schedule?.date)} at ${time12(b.schedule?.time)}`}</Row>
              <Row label="Service">{`${b.service}${b.details?.size ? ` · ${b.details.size}` : ""}`}</Row>
              <Row label="Estimated time">{b.details?.estHours ? `About ${b.details.estHours} hours (for scheduling)` : ""}</Row>
              <Row label="Address">{[b.details?.address, b.details?.area].filter(Boolean).join(", ")}</Row>
              <Row label="Landmark">{b.details?.landmark}</Row>
              <Row label="Property">{[b.details?.propertyType, r.bedrooms && `${r.bedrooms} bed`, r.bathrooms && `${r.bathrooms} bath`, r.kitchens && `${r.kitchens} kitchen`, r.livingRooms && `${r.livingRooms} living`, r.stairs && `${r.stairs} stairs`].filter(Boolean).join(" · ")}</Row>
              <Row label="Pets">{b.details?.pets === undefined ? "" : b.details.pets ? "Yes" : "No"}</Row>
              <Row label="Supplies">{b.details?.supplies === "cleaniq" ? "Cleaniq brings them" : b.details?.supplies === "customer" ? "Customer provides" : ""}</Row>
              <Row label="Parking">{b.details?.parking}</Row>
              <Row label="Access">{b.details?.access}</Row>
              <Row label="Cleaner">{b.assignedWorker ? `${b.assignedWorker.firstName} ${b.assignedWorker.lastName}` : "Not assigned"}</Row>
            </dl>
            {b.details?.instructions && <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/80">“{b.details.instructions}”</p>}
          </Card>

          <Card>
            <h2 className="mb-3 font-extrabold text-white">Notes</h2>
            <ul className="space-y-2">
              {(b.notes || []).map((n, i) => (
                <li key={i} className="rounded-xl bg-white/5 p-3 text-sm">
                  <p className="text-white/85">{n.text}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {n.by} · {dateTime(n.at)}
                  </p>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                await run(() => post("/notes", { text: note }), "Note added");
                setNote("");
                reload();
              }}
            >
              <Input id="note" aria-label="Add a note" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
              <Button type="submit" loading={busy}>
                Add note
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-extrabold text-white">History</h2>
            <ul className="space-y-2 text-sm">
              {[...data.history.map((h) => ({ at: h.createdAt, text: `${h.adminName}: ${h.action.replace("booking.", "")}${h.details?.to ? ` → ${h.details.to}` : ""}` })), ...data.emails.map((e) => ({ at: e.createdAt, text: `Email ${e.status}: ${e.subject}` }))]
                .sort((a, z) => new Date(z.at) - new Date(a.at))
                .map((h, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-28 shrink-0 text-white/40">{dateTime(h.at)}</span>
                    <span className="text-white/80">{h.text}</span>
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 font-extrabold text-white">Customer</h2>
            <dl>
              <Row label="Name">{`${b.customer?.firstName} ${b.customer?.lastName}`}</Row>
              <Row label="Email">{b.customer?.email}</Row>
              <Row label="Phone">{b.customer?.phone}</Row>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {b.customerId && (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/customers/${b.customerId}`)}>
                  Profile
                </Button>
              )}
              {b.customer?.phone && (
                <a href={`https://wa.me/${b.customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 font-extrabold text-white">Price & payment</h2>
            <dl>
              {(b.price?.lines || []).map((l) => (
                <Row key={l.key + l.label} label={`${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`}>
                  {naira(l.amount)}
                </Row>
              ))}
              {b.price?.vat?.enabled && <Row label={`${b.price.vat.label} ${b.price.vat.rate}%`}>{naira(b.price.vat.amount)}</Row>}
              <Row label="Total">{naira(b.payment?.amount)}</Row>
              <Row label="Status">
                <Badge>{b.payment?.status}</Badge>
              </Row>
              <Row label="Method">{[b.payment?.method, b.payment?.channel].filter(Boolean).join(" · ")}</Row>
              <Row label="Paid at">{b.payment?.paidAt && dateTime(b.payment.paidAt)}</Row>
              <Row label="Reference">{b.payment?.reference}</Row>
              {b.payment?.refund?.amount ? <Row label="Refund">{`${naira(b.payment.refund.amount)} (${b.payment.refund.status})`}</Row> : null}
            </dl>
            {b.payment?.problem && <p className="mt-3 rounded-xl bg-rose-400/10 p-3 text-xs font-semibold text-rose-200">⚠ {b.payment.problem}</p>}
          </Card>

          {b.workerPay?.status && b.workerPay.status !== "none" && (
            <Card>
              <h2 className="mb-2 font-extrabold text-white">Cleaner pay</h2>
              <dl>
                <Row label="Amount">{naira(b.workerPay.amount)}</Row>
                <Row label="Status">
                  <Badge>{b.workerPay.status}</Badge>
                </Row>
              </dl>
              {can("owner", "manager") && b.workerPay.status === "unpaid" && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setForm({ amount: b.workerPay.amount }); setModal("workerPay"); }}>
                  Change amount
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <Modal open={modal === "assign"} onClose={close} title="Assign a cleaner" footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button loading={busy} onClick={() => act(() => post("/assign", { workerId: form.workerId || null }, "PATCH"), form.workerId ? "Cleaner assigned" : "Cleaner removed")}>Save</Button></>}>
        <Select
          id="worker"
          label="Cleaner"
          placeholder="No cleaner"
          options={(workers.data?.items || []).map((w) => ({ value: w._id, label: `${w.firstName} ${w.lastName}${w.areas?.length ? ` — ${w.areas.slice(0, 3).join(", ")}` : ""}` }))}
          value={form.workerId}
          onChange={(e) => setForm({ workerId: e.target.value })}
        />
      </Modal>

      <Modal open={modal === "schedule"} onClose={close} title="Reschedule" footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button loading={busy} onClick={() => act(() => post("/schedule", form, "PATCH"), "Rescheduled")}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="date" type="date" label="Date" value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Select id="time" label="Arrival time" options={TIMES.map((t) => ({ value: t, label: time12(t) }))} value={form.time || ""} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
        </div>
        <p className="mt-3 text-xs text-white/50">The customer gets a fresh reminder the day before the new date.</p>
      </Modal>

      <Modal open={modal === "resend"} onClose={close} title="Resend an email">
        <div className="grid gap-2">
          {[
            ["confirmation", "Booking confirmation", isPaid],
            ["payment-link", "Payment link", b.payment?.status === "Pending" && b.payment?.authorizationUrl],
            ["invoice", "Receipt / invoice", ["Paid", "Refunded", "Refund pending"].includes(b.payment?.status)],
          ].map(([type, label, ok]) => (
            <Button key={type} variant="secondary" disabled={!ok} loading={busy} onClick={() => act(() => post("/resend", { type }), `${label} sent`)}>
              {label}
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={modal === "pay"} onClose={close} title="Take payment">
        <p className="text-sm text-white/70">Send the customer a secure Paystack link for {naira(b.payment?.amount)}, or record a payment you've already received.</p>
        <div className="mt-4 grid gap-2">
          <Button
            loading={busy}
            icon={CreditCard}
            onClick={async () => {
              const res = await run(() => post("/payment-link", { email: true }), "Payment link emailed");
              setForm({ link: res.paymentLink });
              reload();
            }}
          >
            {b.payment?.authorizationUrl ? "Email the payment link again" : "Create & email payment link"}
          </Button>
          {(form.link || b.payment?.authorizationUrl) && (
            <div className="flex gap-2">
              <Button variant="secondary" icon={Copy} className="flex-1" onClick={() => copy(form.link || b.payment.authorizationUrl)}>
                Copy link
              </Button>
              {b.customer?.phone && (
                <a
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-bold text-white"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/${b.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${b.customer.firstName}, here's your secure Cleaniq payment link for booking ${b.bookingId} (${naira(b.payment.amount)}): ${form.link || b.payment.authorizationUrl}`)}`}
                >
                  <MessageCircle className="h-4 w-4" /> Send on WhatsApp
                </a>
              )}
            </div>
          )}
          {can("owner", "manager") && (
            <Button variant="secondary" onClick={() => { setForm({ method: "Bank transfer", note: "" }); setModal("paid"); }}>
              Record a payment received (cash / transfer)
            </Button>
          )}
        </div>
      </Modal>

      <Modal open={modal === "paid"} onClose={close} title="Record payment received" footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button loading={busy} onClick={() => act(() => post("/mark-paid", form), "Marked as paid")}>Mark as paid</Button></>}>
        <div className="space-y-4">
          <Select id="method" label="How was it paid?" options={["Bank transfer", "Cash", "POS", "Other"]} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} />
          <Input id="pnote" label="Note (optional)" placeholder="e.g. transfer from GTBank, ref 1234" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          <p className="text-xs text-white/50">The booking is confirmed and the customer gets their confirmation email.</p>
        </div>
      </Modal>

      <Modal open={modal === "cancel"} onClose={close} title="Cancel booking" footer={<><Button variant="ghost" onClick={close}>Keep booking</Button><Button variant="danger" loading={busy} onClick={() => act(() => post("/cancel", form), "Booking cancelled")}>Cancel booking</Button></>}>
        <div className="space-y-4">
          <TextArea id="reason" label="Reason (shown to the customer)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          {isPaid && !b.payment?.offline?.method && (
            <>
              <Toggle id="refund" label={`Refund through Paystack`} checked={Boolean(form.refund)} onChange={(v) => setForm((f) => ({ ...f, refund: v }))} />
              {form.refund && <Input id="ramount" type="number" label={`Refund amount (max ${naira(b.payment.amount)})`} placeholder={String(b.payment.amount)} value={form.refundAmount || ""} onChange={(e) => setForm((f) => ({ ...f, refundAmount: e.target.value }))} hint="Leave empty for a full refund" />}
            </>
          )}
          {isPaid && b.payment?.offline?.method && <p className="text-xs text-amber-200">Paid by {b.payment.offline.method} — refund it the same way.</p>}
          <Toggle id="notify" label="Email the customer" checked={form.notifyCustomer !== false} onChange={(v) => setForm((f) => ({ ...f, notifyCustomer: v }))} />
        </div>
      </Modal>

      <Modal open={modal === "refund"} onClose={close} title="Refund" footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => act(() => post("/refund", form), "Refund requested")}>Refund</Button></>}>
        <div className="space-y-4">
          <Input id="amount" type="number" label={`Amount (max ${naira(b.payment?.amount)})`} placeholder={String(b.payment?.amount)} hint="Leave empty for a full refund" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input id="rreason" label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
      </Modal>

      <Modal open={modal === "workerPay"} onClose={close} title="Cleaner pay" footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button loading={busy} onClick={() => act(() => post("/worker-pay", { amount: Number(form.amount) }, "PATCH"), "Cleaner pay updated")}>Save</Button></>}>
        <Input id="wp" type="number" label="Amount (₦)" value={form.amount} onChange={(e) => setForm({ amount: e.target.value })} />
      </Modal>

      <ConfirmModal
        open={modal === "delete"}
        onClose={close}
        danger
        title="Delete booking?"
        text="It moves to the Bin, where it can be restored."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={async () => {
          await run(() => request(`/admin/bookings/${b.bookingId}`, { method: "DELETE" }), "Moved to the Bin");
          navigate("/admin/bookings");
        }}
      />
    </>
  );
}
