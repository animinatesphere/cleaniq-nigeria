// Month / week view of all bookings, with each job's cleaner.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLoad } from "../auth";
import { Button, Card, ErrorBox, Loading, PageHeader, time12 } from "../ui";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};
const mondayOf = (s) => {
  const d = new Date(`${s}T12:00:00Z`);
  return addDays(s, -((d.getUTCDay() + 6) % 7));
};
const lagosToday = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TONE = { Pending: "border-amber-400 bg-amber-400/10", Confirmed: "border-sky-400 bg-sky-400/10", Assigned: "border-indigo-400 bg-indigo-400/10", "In Progress": "border-violet-400 bg-violet-400/10", Completed: "border-emerald-400 bg-emerald-400/10" };

export default function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState(lagosToday());

  const range = useMemo(() => {
    if (view === "week") {
      const from = mondayOf(anchor);
      return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
    }
    const first = `${anchor.slice(0, 7)}-01`;
    const from = mondayOf(first);
    const last = new Date(Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0));
    const to = addDays(mondayOf(ymd(last)), 6);
    const n = (new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000 + 1;
    return { from, to, days: Array.from({ length: n }, (_, i) => addDays(from, i)) };
  }, [view, anchor]);

  const { data, error, loading, reload } = useLoad(`/admin/bookings/calendar?from=${range.from}&to=${range.to}`);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const b of data?.items || []) m.set(b.schedule.date, [...(m.get(b.schedule.date) || []), b]);
    return m;
  }, [data]);

  const move = (dir) => {
    if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const d = new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + dir);
      setAnchor(ymd(d));
    }
  };
  const title = view === "week" ? `Week of ${new Date(`${range.from}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}` : new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const today = lagosToday();

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={title}
        actions={
          <>
            <div className="flex rounded-xl bg-white/8 p-1">
              {["month", "week"].map((v) => (
                <button key={v} onClick={() => setView(v)} className={`relative rounded-lg px-3 py-1.5 text-sm font-bold capitalize ${view === v ? "text-adm-bg" : "text-white/70"}`}>
                  {view === v && <motion.span layoutId="cal-view" className="absolute inset-0 rounded-lg bg-emerald-400" />}
                  <span className="relative">{v}</span>
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={ChevronLeft} onClick={() => move(-1)} aria-label="Previous" />
            <Button variant="secondary" onClick={() => setAnchor(today)}>Today</Button>
            <Button variant="secondary" icon={ChevronRight} onClick={() => move(1)} aria-label="Next" />
          </>
        }
      />
      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : view === "month" ? (
        <>
          <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 md:grid">
            {DAYS.map((d) => (
              <div key={d} className="bg-adm-card px-2 py-2 text-center text-xs font-bold text-white/50 uppercase">{d}</div>
            ))}
            {range.days.map((d) => {
              const items = byDay.get(d) || [];
              const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
              return (
                <div key={d} className={`min-h-28 bg-adm-card p-1.5 ${inMonth ? "" : "opacity-40"}`}>
                  <p className={`mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${d === today ? "bg-emerald-400 text-adm-bg" : "text-white/60"}`}>{Number(d.slice(8))}</p>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((b) => (
                      <button key={b._id} onClick={() => navigate(`/admin/bookings/${b.bookingId}`)} className={`block w-full truncate rounded-md border-l-2 px-1.5 py-1 text-left text-[11px] text-white ${TONE[b.status] || ""}`}>
                        {time12(b.schedule.time)} {b.customer?.firstName} · {b.assignedWorkerName || "—"}
                      </button>
                    ))}
                    {items.length > 3 && (
                      <button onClick={() => { setAnchor(d); setView("week"); }} className="text-[11px] font-bold text-emerald-300">
                        +{items.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Phones: a simple list of days that have jobs */}
          <AgendaList days={range.days.filter((d) => d.slice(0, 7) === anchor.slice(0, 7))} byDay={byDay} today={today} onOpen={(id) => navigate(`/admin/bookings/${id}`)} className="md:hidden" />
        </>
      ) : (
        <AgendaList days={range.days} byDay={byDay} today={today} showEmpty onOpen={(id) => navigate(`/admin/bookings/${id}`)} />
      )}
    </>
  );
}

function AgendaList({ days, byDay, today, onOpen, showEmpty, className = "" }) {
  const shown = days.filter((d) => showEmpty || byDay.get(d)?.length);
  if (!shown.length) return <Card className={className}><p className="text-sm text-white/50">No bookings in this period.</p></Card>;
  return (
    <div className={`space-y-3 ${className}`}>
      <AnimatePresence initial={false}>
        {shown.map((d) => (
          <motion.div key={d} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4">
              <p className={`text-sm font-extrabold ${d === today ? "text-emerald-300" : "text-white"}`}>
                {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}
                {d === today && " · Today"}
              </p>
              {(byDay.get(d) || []).length ? (
                <ul className="mt-2 space-y-1.5">
                  {byDay.get(d).map((b) => (
                    <li key={b._id}>
                      <button onClick={() => onOpen(b.bookingId)} className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-l-2 px-3 py-2 text-left text-sm ${TONE[b.status] || ""}`}>
                        <span className="font-bold text-white">{time12(b.schedule.time)}</span>
                        <span className="text-white/85">{b.customer?.firstName} {b.customer?.lastName} · {b.service}{b.details?.size ? ` (${b.details.size})` : ""}</span>
                        <span className="text-white/50">{b.details?.area} · {b.assignedWorkerName || "No cleaner"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-white/40">Nothing booked</p>
              )}
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
