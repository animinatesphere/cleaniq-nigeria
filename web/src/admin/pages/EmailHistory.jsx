// Admin → Email history (like the UK page): every email the system sent, with failures.
import { useState } from "react";
import { useLoad } from "../auth";
import { Badge, DataTable, Empty, ErrorBox, Loading, Modal, PageHeader, Pagination, SearchBox, Select, dateTime } from "../ui";

export default function EmailHistory() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const qs = new URLSearchParams({ page, limit: 30, ...(q && { q }), ...(status && { status }) });
  const { data, error, loading, reload } = useLoad(`/admin/emails?${qs}`);

  const columns = [
    { key: "date", label: "Sent", render: (e) => dateTime(e.createdAt) },
    { key: "to", label: "To", render: (e) => <span className="font-bold text-white">{e.to}</span> },
    { key: "subject", label: "Subject", render: (e) => <span className="line-clamp-1">{e.subject}</span> },
    { key: "type", label: "Type", render: (e) => <span className="text-white/60">{(e.type || "—").replace(/-/g, " ")}</span> },
    { key: "ref", label: "Ref", render: (e) => e.ref || "—" },
    { key: "status", label: "Status", render: (e) => <Badge>{e.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Email history" subtitle="Every email sent to customers, cleaners and the team."
        actions={<Select id="em-status" aria-label="Status" options={[{ value: "", label: "All" }, { value: "sent", label: "Sent" }, { value: "failed", label: "Failed" }, { value: "skipped", label: "Skipped" }]} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />} />
      <div className="mb-4"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Email address, subject, reference…" /></div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} onRowClick={setView} empty={<Empty title="No emails yet" />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
      <Modal open={Boolean(view)} onClose={() => setView(null)} title={view?.subject || ""}>
        {view && (
          <dl className="space-y-3 text-sm">
            {[["To", view.to], ["Sent", dateTime(view.createdAt)], ["Type", view.type], ["Reference", view.ref], ["Status", view.status], ["Error", view.error], ["Provider ID", view.providerId]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 break-words text-white/85">{v}</dd></div>
            ))}
          </dl>
        )}
      </Modal>
    </>
  );
}
