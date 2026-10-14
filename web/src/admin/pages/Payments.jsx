// Admin → Payments (like the UK Payment Approvals page): every Paystack and offline payment, totals,
// filters by status and date, and recent refunds.
import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, RotateCcw, ShieldAlert, XCircle } from "lucide-react";
import { useLoad } from "../auth";
import { Badge, Card, DataTable, Empty, ErrorBox, Input, Loading, PageHeader, Pagination, SearchBox, Select, StatCard, dateTime, naira } from "../ui";

export default function Payments() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page, limit: 25, ...(status && { status }), ...(q && { q }), ...(from && { from }), ...(to && { to }) });
  const { data, error, loading, reload } = useLoad(`/admin/payments?${qs}`);
  const t = data?.totals || {};

  const columns = [
    { key: "paid", label: "Date", render: (p) => dateTime(p.paidAt || p.createdAt) },
    { key: "booking", label: "Booking", render: (p) => (p.bookingId ? <span className="font-bold text-white">{p.bookingId}</span> : p.subscription ? "Monthly plan" : "—") },
    { key: "email", label: "Customer", render: (p) => p.email || "—" },
    { key: "amount", label: "Amount", render: (p) => <span className="font-bold">{naira(p.amount)}</span> },
    { key: "channel", label: "Method", render: (p) => <span className="capitalize">{p.channel || "—"}</span> },
    { key: "ref", label: "Reference", render: (p) => <span className="font-mono text-xs text-white/60">{p.reference}</span> },
    { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment taken through Paystack or recorded by staff, and refunds." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Paid" value={naira(t.success?.amount || 0)} hint={`${t.success?.count || 0} payments`} icon={CheckCircle2} onClick={() => { setStatus("success"); setPage(1); }} />
        <StatCard label="Refunded" value={naira(t.refunded?.amount || 0)} hint={`${t.refunded?.count || 0} payments`} icon={RotateCcw} tone="sky" onClick={() => { setStatus("refunded"); setPage(1); }} />
        <StatCard label="Failed" value={t.failed?.count || 0} hint="payment attempts" icon={XCircle} tone="rose" onClick={() => { setStatus("failed"); setPage(1); }} />
        <StatCard label="Amount mismatch" value={t.mismatch?.count || 0} hint="paid a different amount — check" icon={ShieldAlert} tone="amber" onClick={() => { setStatus("mismatch"); setPage(1); }} />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Reference, booking, email…" />
          <Select id="pay-status" aria-label="Status" options={[{ value: "", label: "All statuses" }, { value: "success", label: "Paid" }, { value: "refunded", label: "Refunded" }, { value: "failed", label: "Failed" }, { value: "mismatch", label: "Mismatch" }]} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
          <Input id="pay-from" type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input id="pay-to" type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
      </Card>

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(p) => p.reference}
            onRowClick={(p) => p.bookingId && navigate(`/admin/bookings/${p.bookingId}`)}
            empty={<Empty title="No payments yet" text="Payments appear here as soon as Paystack confirms them." />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />

          {data.refunds?.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-lg font-extrabold text-white">Recent refunds</h2>
              <DataTable rowKey={(b) => b.bookingId} onRowClick={(b) => navigate(`/admin/bookings/${b.bookingId}`)}
                columns={[
                  { key: "b", label: "Booking", render: (b) => <span className="font-bold text-white">{b.bookingId}</span> },
                  { key: "c", label: "Customer", render: (b) => `${b.customer?.firstName || ""} ${b.customer?.lastName || ""}` },
                  { key: "a", label: "Amount", render: (b) => naira(b.payment?.refund?.amount) },
                  { key: "r", label: "Reason", render: (b) => b.payment?.refund?.reason || "—" },
                  { key: "by", label: "By", render: (b) => b.payment?.refund?.by || "—" },
                  { key: "d", label: "Requested", render: (b) => dateTime(b.payment?.refund?.requestedAt) },
                  { key: "s", label: "Status", render: (b) => <Badge>{b.payment?.refund?.status || "pending"}</Badge> },
                ]}
                rows={data.refunds} />
            </>
          )}
        </>
      )}
    </>
  );
}
