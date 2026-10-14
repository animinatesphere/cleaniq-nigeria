// Admin → Rota: the week at a glance — each cleaner's jobs day by day, plus jobs still needing a cleaner.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useLoad } from "../auth";
import { Button, Card, ErrorBox, Loading, PageHeader, time12 } from "../ui";

const lagosToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const monday = (d) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
const dayHead = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const STATUS = { Confirmed: "border-sky-400/50 bg-sky-400/10", Assigned: "border-indigo-400/50 bg-indigo-400/10", "In Progress": "border-violet-400/50 bg-violet-400/10", Completed: "border-emerald-400/50 bg-emerald-400/10", Pending: "border-amber-400/50 bg-amber-400/10" };

export default function Rota() {
  const navigate = useNavigate();
  const [start, setStart] = useState(monday(lagosToday()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const { data, error, loading, reload } = useLoad(`/admin/bookings/calendar?from=${days[0]}&to=${days[6]}`);
  const workers = useLoad("/admin/workers?status=active&limit=100");

  const rows = useMemo(() => {
    const items = data?.items || [];
    const list = (workers.data?.items || []).map((w) => ({ id: w._id, name: `${w.firstName} ${w.lastName || ""}`.trim(), jobs: items.filter((b) => String(b.assignedWorker) === String(w._id)) }));
    return [{ id: "none", name: "Needs a cleaner", jobs: items.filter((b) => !b.assignedWorker) }, ...list];
  }, [data, workers.data]);
  const today = lagosToday();

  return (
    <>
      <PageHeader title="Rota" subtitle="Who's working where this week. Tap a job to open it."
        actions={<Button variant="secondary" icon={CalendarDays} onClick={() => navigate("/admin/calendar")}>Calendar</Button>} />
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-adm-card p-2">
        <Button variant="ghost" icon={ChevronLeft} aria-label="Previous week" onClick={() => setStart(addDays(start, -7))} />
        <button type="button" className="text-base font-extrabold text-white" onClick={() => setStart(monday(today))}>{dayHead(days[0])} – {dayHead(days[6])}</button>
        <Button variant="ghost" icon={ChevronRight} aria-label="Next week" onClick={() => setStart(addDays(start, 7))} />
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : (loading && !data) || (workers.loading && !workers.data) ? <Loading /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-40 bg-adm-card p-3 text-left text-xs font-bold tracking-wide text-white/45 uppercase">Cleaner</th>
                {days.map((d) => <th key={d} className={`p-3 text-left text-xs font-bold tracking-wide uppercase ${d === today ? "text-emerald-300" : "text-white/45"}`}>{dayHead(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <th scope="row" className={`sticky left-0 z-10 bg-adm-card p-3 text-left font-bold ${r.id === "none" ? "text-amber-300" : "text-white"}`}>
                    {r.name}<span className="block text-xs font-normal text-white/40">{r.jobs.length} job{r.jobs.length === 1 ? "" : "s"}</span>
                  </th>
                  {days.map((d) => (
                    <td key={d} className={`p-1.5 ${d === today ? "bg-emerald-400/[0.03]" : ""}`}>
                      <div className="space-y-1.5">
                        {r.jobs.filter((b) => b.schedule?.date === d).map((b) => (
                          <button key={b.bookingId} type="button" onClick={() => navigate(`/admin/bookings/${b.bookingId}`)}
                            className={`block w-full rounded-lg border-l-4 p-2 text-left transition hover:brightness-125 ${STATUS[b.status] || "border-white/30 bg-white/5"}`}>
                            <span className="block text-xs font-bold text-white">{time12(b.schedule?.time)}{b.details?.estHours ? ` · ${b.details.estHours}h` : ""}</span>
                            <span className="block truncate text-xs text-white/75">{b.service}</span>
                            <span className="block truncate text-[11px] text-white/45">{b.details?.area}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
