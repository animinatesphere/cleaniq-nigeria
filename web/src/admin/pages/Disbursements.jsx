// Admin → Disbursement: every payout to cleaners (monthly payroll and one-off payouts) and its Paystack status.
import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, CheckCircle2, HandCoins, Loader } from "lucide-react";
import { useLoad } from "../auth";
import { Badge, Button, DataTable, Empty, ErrorBox, Loading, Modal, PageHeader, Pagination, StatCard, dateTime, naira } from "../ui";

const monthName = (m) => (m ? new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "");

export default function Disbursements() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const { data, error, loading, reload } = useLoad(`/admin/staff-pay/withdrawals?page=${page}&limit=25${status ? `&status=${status}` : ""}`);
  const items = data?.items || [];
  const sum = (s) => items.filter((x) => x.status === s).reduce((t, x) => t + x.amount, 0);

  const columns = [
    { key: "who", label: "Cleaner", render: (x) => <span className="font-bold text-white">{x.workerName}</span> },
    { key: "what", label: "For", render: (x) => (x.kind === "payroll" ? `${monthName(x.month)} pay` : `${x.bookings?.length || 0} job${x.bookings?.length === 1 ? "" : "s"}`) },
    { key: "amount", label: "Amount", render: (x) => <span className="font-bold">{naira(x.amount)}</span> },
    { key: "method", label: "Paid by", render: (x) => (x.method === "paystack" ? "Paystack transfer" : x.method) },
    { key: "bank", label: "Account", render: (x) => (x.bank?.accountNumber ? `${x.bank.bankName} ••${x.bank.accountNumber.slice(-4)}` : "—") },
    { key: "when", label: "Date", render: (x) => dateTime(x.paidAt || x.createdAt) },
    { key: "status", label: "Status", render: (x) => <Badge>{x.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Disbursement" subtitle="Money sent to cleaners — monthly pay on payday and any one-off payouts."
        actions={<Button icon={HandCoins} onClick={() => navigate("/admin/staff-pay")}>Run payroll</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Paid (this list)" value={naira(sum("Paid"))} icon={CheckCircle2} tone="emerald" onClick={() => { setStatus("Paid"); setPage(1); }} />
        <StatCard label="Sending" value={naira(sum("Processing"))} hint="Waiting for the bank" icon={Loader} tone="sky" onClick={() => { setStatus("Processing"); setPage(1); }} />
        <StatCard label="Requested" value={naira(sum("Requested"))} icon={HandCoins} tone="amber" onClick={() => { setStatus("Requested"); setPage(1); }} />
        <StatCard label="Failed" value={naira(sum("Failed"))} hint="Check the bank details" icon={AlertTriangle} tone="rose" onClick={() => { setStatus("Failed"); setPage(1); }} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "Requested", "Processing", "Paid", "Failed", "Rejected"].map((s) => (
          <button key={s || "all"} type="button" onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${status === s ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>{s || "All"}</button>
        ))}
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={items} onRowClick={setView} empty={<Empty title="No payouts yet" text="When you pay cleaners from Staff pay, each payment shows here." />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
      <Modal open={Boolean(view)} onClose={() => setView(null)} title={view ? `${view.workerName} — ${naira(view.amount)}` : ""}>
        {view && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[["Status", view.status], ["For", view.kind === "payroll" ? `${monthName(view.month)} pay` : "Job payout"], ["Paid by", view.method === "paystack" ? "Paystack transfer" : view.method],
              ["Reference", view.reference], ["Bank", view.bank?.bankName], ["Account", view.bank?.accountNumber ? `${view.bank.accountName} · ${view.bank.accountNumber}` : ""],
              ["Salary", view.breakdown?.salary ? naira(view.breakdown.salary) : ""], ["Jobs", view.breakdown?.jobsCount ? `${view.breakdown.jobsCount} · ${naira(view.breakdown.jobsAmount)}` : ""],
              ["Bonuses / deductions", view.breakdown?.adjustments ? naira(view.breakdown.adjustments) : ""], ["Requested", dateTime(view.createdAt)], ["Paid", view.paidAt ? dateTime(view.paidAt) : ""],
              ["By", view.reviewedBy || view.requestedBy], ["Problem", view.failureReason], ["Note", view.note]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 break-words text-white/85">{v}</dd></div>
            ))}
          </dl>
        )}
      </Modal>
    </>
  );
}
