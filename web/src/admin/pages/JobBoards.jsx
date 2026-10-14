// Operations job pages built on the jobs list (/admin/bookings/jobs):
//  • Assign jobs — every job needing a cleaner, with cleaners who cover that area suggested first
//  • Job visibility — hide jobs or show them only to chosen cleaners, right from the list
//  • Company jobs — the open jobs board exactly as cleaners see it in the worker app
import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Briefcase, Clock, Eye, EyeOff, MapPin, UserCheck, Users } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Modal, PageHeader, Select, StatCard, Toggle, naira, shortDate, time12, useAction } from "../ui";

function useJobs() {
  const jobs = useLoad("/admin/bookings/jobs");
  const workers = useLoad("/admin/workers?status=active&limit=100");
  return { jobs, workers: workers.data?.items || [] };
}
const when = (b) => `${shortDate(b.schedule?.date)} · ${time12(b.schedule?.time)}`;
const covers = (w, area) => !w.areas?.length || w.areas.some((a) => String(area || "").toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(String(area || "").toLowerCase()));

function JobCard({ b, children, onOpen }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="flex h-full flex-col">
        <button type="button" onClick={onOpen} className="text-left">
          <div className="flex items-start justify-between gap-2">
            <p className="font-extrabold text-white">{b.service}</p>
            <Badge>{b.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-white/60">{b.details?.size}{b.details?.estHours ? ` · about ${b.details.estHours}h` : ""}</p>
          <div className="mt-3 space-y-1 text-sm text-white/75">
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-emerald-300" />{when(b)}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-300" />{b.details?.area || "—"}</p>
          </div>
          <p className="mt-2 text-xs text-white/40">{b.bookingId} · {b.customer?.firstName} {b.customer?.lastName}</p>
        </button>
        <div className="mt-4 flex-1" />
        {children}
      </Card>
    </motion.div>
  );
}

export function AssignJobs() {
  const navigate = useNavigate();
  const { request } = useAuth();
  const [run, busy] = useAction();
  const { jobs, workers } = useJobs();
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState({});
  const list = (jobs.data?.items || []).filter((b) => showAll || !b.assignedWorker);
  const load = Object.fromEntries(workers.map((w) => [w._id, (jobs.data?.items || []).filter((b) => String(b.assignedWorker) === String(w._id)).length]));

  async function assign(b) {
    const workerId = picked[b.bookingId] ?? (b.assignedWorker || "");
    await run(() => request(`/admin/bookings/${b.bookingId}/assign`, { method: "PATCH", body: { workerId: workerId || null } }), workerId ? "Cleaner assigned" : "Cleaner removed").catch(() => {});
    jobs.reload();
  }

  return (
    <>
      <PageHeader title="Assign jobs" subtitle="Give each upcoming job a cleaner. Cleaners who cover the job's area are listed first."
        actions={<Toggle id="aj-all" label="Show assigned jobs too" checked={showAll} onChange={setShowAll} />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Need a cleaner" value={(jobs.data?.items || []).filter((b) => !b.assignedWorker).length} icon={UserCheck} tone="amber" />
        <StatCard label="Upcoming jobs" value={jobs.data?.items?.length || 0} icon={Briefcase} tone="sky" />
        <StatCard label="Active cleaners" value={workers.length} icon={Users} tone="emerald" />
        <StatCard label="Busiest cleaner" value={workers.length ? [...workers].sort((a, b) => load[b._id] - load[a._id])[0].firstName : "—"} hint={workers.length ? `${Math.max(...workers.map((w) => load[w._id]))} upcoming jobs` : undefined} icon={Users} tone="rose" />
      </div>
      {jobs.error ? <ErrorBox error={jobs.error} onRetry={jobs.reload} /> : jobs.loading && !jobs.data ? <Loading /> : !list.length ? (
        <Empty title="Every job has a cleaner" text="New confirmed bookings that need a cleaner will show up here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const sorted = [...workers].sort((x, y) => Number(covers(y, b.details?.area)) - Number(covers(x, b.details?.area)) || load[x._id] - load[y._id]);
            const value = picked[b.bookingId] ?? (b.assignedWorker || "");
            return (
              <JobCard key={b.bookingId} b={b} onOpen={() => navigate(`/admin/bookings/${b.bookingId}`)}>
                <div className="flex gap-2">
                  <Select id={`aj-${b.bookingId}`} aria-label="Cleaner" className="flex-1" placeholder="Choose a cleaner…" value={value} onChange={(e) => setPicked({ ...picked, [b.bookingId]: e.target.value })}
                    options={sorted.map((w) => ({ value: w._id, label: `${w.firstName} ${w.lastName || ""}${covers(w, b.details?.area) && w.areas?.length ? " ✓ area" : ""} · ${load[w._id]} jobs` }))} />
                  <Button icon={UserCheck} loading={busy} disabled={value === (b.assignedWorker || "")} onClick={() => assign(b)}>Save</Button>
                </div>
              </JobCard>
            );
          })}
        </div>
      )}
    </>
  );
}

export function JobVisibility() {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const { jobs, workers } = useJobs();
  const [edit, setEdit] = useState(null);
  const items = jobs.data?.items || [];
  const save = (b, body, msg) => run(() => request(`/admin/bookings/${b.bookingId}/visibility`, { method: "PATCH", body }), msg).then(() => { setEdit(null); jobs.reload(); }).catch(() => {});

  return (
    <>
      <PageHeader title="Job visibility" subtitle="Choose which upcoming jobs cleaners can see and pick up in the worker app." />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Everyone can see" value={items.filter((b) => !b.job?.hidden && !b.job?.visibleTo?.length).length} icon={Eye} tone="emerald" />
        <StatCard label="Chosen cleaners only" value={items.filter((b) => !b.job?.hidden && b.job?.visibleTo?.length).length} icon={Users} tone="sky" />
        <StatCard label="Hidden" value={items.filter((b) => b.job?.hidden).length} icon={EyeOff} tone="rose" />
      </div>
      {jobs.error ? <ErrorBox error={jobs.error} onRetry={jobs.reload} /> : jobs.loading && !jobs.data ? <Loading /> : !items.length ? <Empty title="No upcoming jobs" text="Confirmed bookings show up here." /> : (
        <Card className="divide-y divide-white/5 p-0">
          {items.map((b) => (
            <div key={b.bookingId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{b.service} <span className="font-normal text-white/45">· {b.details?.area}</span></p>
                <p className="text-sm text-white/55">{when(b)} · {b.assignedWorkerName || "No cleaner yet"}</p>
              </div>
              <span className="text-sm text-white/70">{b.job?.hidden ? <Badge tone="Cancelled">Hidden</Badge> : b.job?.visibleTo?.length ? `${b.job.visibleTo.map((w) => w.firstName).join(", ")} only` : "All cleaners"}</span>
              <div className="flex gap-2">
                <Toggle id={`jv-${b.bookingId}`} label={b.job?.hidden ? "Hidden" : "Visible"} checked={!b.job?.hidden} onChange={(v) => save(b, { hidden: !v, visibleTo: (b.job?.visibleTo || []).map((w) => w._id) }, v ? "Cleaners can see it" : "Hidden from cleaners")} />
                <Button size="sm" variant="secondary" onClick={() => setEdit({ b, visibleTo: (b.job?.visibleTo || []).map((w) => w._id) })}>Choose cleaners</Button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Who can see this job?"
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={() => save(edit.b, { hidden: false, visibleTo: edit.visibleTo }, "Saved")}>Save</Button></>}>
        {edit && (
          <fieldset>
            <legend className="mb-2 text-sm text-white/60">Tick cleaners to show it only to them. Leave all unticked for everyone.</legend>
            <div className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
              {workers.map((w) => (
                <label key={w._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white hover:bg-white/5">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={edit.visibleTo.includes(w._id)}
                    onChange={(e) => setEdit({ ...edit, visibleTo: e.target.checked ? [...edit.visibleTo, w._id] : edit.visibleTo.filter((x) => x !== w._id) })} />
                  {w.firstName} {w.lastName}{covers(w, edit.b.details?.area) && w.areas?.length ? <span className="text-xs text-emerald-300">covers area</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Modal>
    </>
  );
}

export function CompanyJobs() {
  const navigate = useNavigate();
  const { jobs } = useJobs();
  const open = (jobs.data?.items || []).filter((b) => !b.assignedWorker && !b.job?.hidden);
  const taken = (jobs.data?.items || []).filter((b) => b.assignedWorker);
  return (
    <>
      <PageHeader title="Company jobs" subtitle="The open jobs board — what cleaners see in the worker app and can accept."
        actions={<><Button variant="secondary" icon={EyeOff} onClick={() => navigate("/admin/job-visibility")}>Job visibility</Button><Button icon={UserCheck} onClick={() => navigate("/admin/assign-jobs")}>Assign jobs</Button></>} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Open to cleaners" value={open.length} icon={Briefcase} tone="emerald" />
        <StatCard label="Taken" value={taken.length} icon={UserCheck} tone="sky" />
        <StatCard label="Worth (open)" value={naira(open.reduce((s, b) => s + (b.payment?.amount || 0), 0))} icon={Briefcase} tone="amber" />
      </div>
      {jobs.error ? <ErrorBox error={jobs.error} onRetry={jobs.reload} /> : jobs.loading && !jobs.data ? <Loading /> : !open.length ? (
        <Empty title="No open jobs right now" text="Confirmed jobs without a cleaner (and not hidden) appear here for cleaners to accept." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {open.map((b) => (
            <JobCard key={b.bookingId} b={b} onOpen={() => navigate(`/admin/bookings/${b.bookingId}`)}>
              <p className="text-xs text-white/50">{b.job?.visibleTo?.length ? `Only ${b.job.visibleTo.map((w) => w.firstName).join(", ")} can see this` : "All cleaners can see this"}</p>
            </JobCard>
          ))}
        </div>
      )}
    </>
  );
}
