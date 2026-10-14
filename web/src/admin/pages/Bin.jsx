// Admin → Bin (like the UK page): deleted things, restore or delete forever (owner only).
import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Button, ConfirmModal, DataTable, Empty, ErrorBox, Loading, PageHeader, Pagination, SearchBox, dateTime, useAction } from "../ui";

export default function Bin() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [forever, setForever] = useState(null);
  const qs = new URLSearchParams({ page, limit: 30, ...(q && { q }) });
  const { data, error, loading, reload } = useLoad(`/admin/bin?${qs}`);

  const restore = async (item) => {
    await run(() => request(`/admin/bin/${item._id}/restore`, { method: "POST" }), `Restored: ${item.label}`);
    reload();
  };
  const destroy = async () => {
    await run(() => request(`/admin/bin/${forever._id}`, { method: "DELETE" }), "Deleted forever");
    setForever(null);
    reload();
  };

  const columns = [
    { key: "label", label: "Item", render: (i) => <span className="font-bold text-white">{i.label}</span> },
    { key: "type", label: "Type", render: (i) => i.modelName },
    { key: "by", label: "Deleted by", render: (i) => i.deletedBy || "—" },
    { key: "date", label: "Deleted", render: (i) => dateTime(i.createdAt) },
    { key: "act", label: "", className: "text-right", render: (i) => (
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy} onClick={() => restore(i)}>Restore</Button>
        {can("owner") && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setForever(i)}>Delete forever</Button>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Bin" subtitle="Deleted bookings, quotes, customers and more. Restore anything deleted by mistake." />
      <div className="mb-4"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search the Bin…" /></div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} empty={<Empty title="The Bin is empty" text="Anything deleted in the admin comes here first." />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
      <ConfirmModal open={Boolean(forever)} onClose={() => setForever(null)} onConfirm={destroy} danger loading={busy}
        title="Delete forever?" text={`"${forever?.label}" will be gone for good. This can't be undone.`} confirmLabel="Delete forever" />
    </>
  );
}
