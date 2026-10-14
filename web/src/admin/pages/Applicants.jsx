import { useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, DataTable, Empty, ErrorBox, Loading, Modal, PageHeader, Select, dateTime, useAction } from "../ui";

export default function Applicants() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [status, setStatus] = useState("new");
  const { data, error, loading, reload } = useLoad(`/admin/applicants?status=${status}&limit=100`);
  const [view, setView] = useState(null);

  const decide = async (a, action) => {
    await run(() => request(`/admin/applicants/${a._id}/${action}`, { method: "POST" }), action === "accept" ? "Accepted — cleaner account created and welcome email sent" : "Application rejected");
    setView(null);
    reload();
  };

  const columns = [
    { key: "name", label: "Name", render: (a) => <span className="font-bold text-white">{a.firstName} {a.lastName}</span> },
    { key: "phone", label: "Phone" },
    { key: "area", label: "Area" },
    { key: "experience", label: "Experience", render: (a) => <span className="line-clamp-1">{a.experience || "—"}</span> },
    { key: "date", label: "Applied", render: (a) => dateTime(a.createdAt) },
    { key: "status", label: "Status", render: (a) => <Badge>{a.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Applicants" subtitle="Cleaner job applications from the website (/join)."
        actions={<Select id="ap-status" aria-label="Status" options={[{ value: "new", label: "New" }, { value: "accepted", label: "Accepted" }, { value: "rejected", label: "Rejected" }]} value={status} onChange={(e) => setStatus(e.target.value)} />} />
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <DataTable columns={columns} rows={data.items} onRowClick={setView} empty={<Empty title="No applications" text="Applications from the Join our team page show up here." />} />
      )}
      <Modal open={Boolean(view)} onClose={() => setView(null)} title={view ? `${view.firstName} ${view.lastName}` : ""}
        footer={view?.status === "new" && can("owner", "manager") && (
          <>
            <Button variant="danger" icon={X} loading={busy} onClick={() => decide(view, "reject")}>Reject</Button>
            <Button icon={Check} loading={busy} onClick={() => decide(view, "accept")}>Accept & create cleaner</Button>
          </>
        )}>
        {view && (
          <dl className="space-y-3 text-sm">
            {[["Email", view.email], ["Phone", view.phone], ["Area", view.area], ["Experience", view.experience], ["Availability", view.availability], ["Message", view.message], ["Applied", dateTime(view.createdAt)], ["Reviewed by", view.reviewedBy]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-white/85">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </>
  );
}
