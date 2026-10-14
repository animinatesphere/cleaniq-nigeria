// Jobs for cleaners: who's assigned, assign manually, hide a job or show it only to chosen cleaners.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, UserCheck } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, DataTable, Empty, ErrorBox, Loading, Modal, PageHeader, Select, Toggle, shortDate, time12, useAction } from "../ui";

export default function Jobs() {
  const navigate = useNavigate();
  const { request } = useAuth();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad("/admin/bookings/jobs");
  const workers = useLoad("/admin/workers?status=active&limit=100");
  const [edit, setEdit] = useState(null); // { booking, mode: "assign" | "visibility", ... }
  const [filter, setFilter] = useState("all");

  const rows = (data?.items || []).filter((b) => filter === "all" || (filter === "unassigned" ? !b.assignedWorker : b.job?.hidden));
  const workerOptions = (workers.data?.items || []).map((w) => ({ value: w._id, label: `${w.firstName} ${w.lastName}` }));

  const columns = [
    { key: "when", label: "When", render: (b) => `${shortDate(b.schedule?.date)} ${time12(b.schedule?.time)}` },
    { key: "job", label: "Job", render: (b) => `${b.service}${b.details?.size ? ` · ${b.details.size}` : ""}${b.details?.estHours ? ` · ~${b.details.estHours}h` : ""}` },
    { key: "area", label: "Area", render: (b) => b.details?.area },
    { key: "cleaner", label: "Cleaner", render: (b) => b.assignedWorkerName || <Badge tone="Pending">Needs a cleaner</Badge> },
    {
      key: "seen", label: "Who can see it",
      render: (b) => (b.job?.hidden ? <Badge tone="Cancelled">Hidden</Badge> : b.job?.visibleTo?.length ? `${b.job.visibleTo.map((w) => w.firstName).join(", ")} only` : "All cleaners"),
    },
    {
      key: "actions", label: "", hideOnCard: false,
      render: (b) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" icon={UserCheck} onClick={() => setEdit({ booking: b, mode: "assign", workerId: b.assignedWorker || "" })}>
            Assign
          </Button>
          <Button size="sm" variant="secondary" icon={b.job?.hidden ? EyeOff : Eye} onClick={() => setEdit({ booking: b, mode: "visibility", hidden: Boolean(b.job?.hidden), visibleTo: (b.job?.visibleTo || []).map((w) => w._id) })}>
            Visibility
          </Button>
        </div>
      ),
    },
  ];

  async function save() {
    const b = edit.booking;
    if (edit.mode === "assign") await run(() => request(`/admin/bookings/${b.bookingId}/assign`, { method: "PATCH", body: { workerId: edit.workerId || null } }), "Cleaner updated");
    else await run(() => request(`/admin/bookings/${b.bookingId}/visibility`, { method: "PATCH", body: { hidden: edit.hidden, visibleTo: edit.visibleTo } }), "Visibility updated");
    setEdit(null);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Upcoming confirmed jobs and which cleaners can see them in the worker app."
        actions={<Select id="jobs-filter" aria-label="Filter" options={[{ value: "all", label: "All upcoming" }, { value: "unassigned", label: "Need a cleaner" }, { value: "hidden", label: "Hidden" }]} value={filter} onChange={(e) => setFilter(e.target.value)} />}
      />
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <DataTable columns={columns} rows={rows} onRowClick={(b) => navigate(`/admin/bookings/${b.bookingId}`)} empty={<Empty title="No upcoming jobs" text="Confirmed bookings appear here." />} />
      )}

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.mode === "assign" ? "Assign a cleaner" : "Who can see this job?"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}
      >
        {edit?.mode === "assign" ? (
          <Select id="assign-worker" label="Cleaner" placeholder="No cleaner" options={workerOptions} value={edit.workerId} onChange={(e) => setEdit({ ...edit, workerId: e.target.value })} />
        ) : edit ? (
          <div className="space-y-4">
            <Toggle id="hide" label="Hide this job from all cleaners" checked={edit.hidden} onChange={(v) => setEdit({ ...edit, hidden: v })} />
            {!edit.hidden && (
              <fieldset>
                <legend className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">Only show to (leave all unticked for everyone)</legend>
                <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                  {workerOptions.map((w) => (
                    <label key={w.value} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white hover:bg-white/5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-400"
                        checked={edit.visibleTo.includes(w.value)}
                        onChange={(e) => setEdit({ ...edit, visibleTo: e.target.checked ? [...edit.visibleTo, w.value] : edit.visibleTo.filter((x) => x !== w.value) })}
                      />
                      {w.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
