// Admin → Cleaner performance: jobs done, value, star rating, punctuality and complaints, month by month.
import { useState } from "react";
import { motion } from "framer-motion";
import { Award, ChevronLeft, ChevronRight, Clock, ShieldAlert, Star } from "lucide-react";
import { useLoad } from "../auth";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, StatCard, naira } from "../ui";

const lagosMonth = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 7);
const shift = (m, n) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const monthName = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function Stars({ value }) {
  if (value === null) return <span className="text-xs text-white/40">No ratings</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(value) ? "fill-amber-300 text-amber-300" : "text-white/20"}`} />)}
      <span className="ml-1 text-xs font-bold text-white">{value.toFixed(1)}</span>
    </span>
  );
}

export default function WorkerPerformance() {
  const [month, setMonth] = useState(lagosMonth());
  const { data, error, loading, reload } = useLoad(`/admin/analytics/cleaners?month=${month}`);
  const rows = data?.cleaners || [];
  const active = rows.filter((r) => r.assigned > 0);
  const rated = active.filter((r) => r.rating !== null);
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.rating * r.ratings, 0) / rated.reduce((s, r) => s + r.ratings, 0) : null;
  const best = [...rated].sort((a, b) => b.rating - a.rating || b.completed - a.completed)[0];
  const punctual = active.filter((r) => r.onTimeRate !== null);

  return (
    <>
      <PageHeader title="Cleaner performance" subtitle="How each cleaner is doing — from completed jobs, customer star ratings, start times and complaints." />
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-adm-card p-2">
        <Button variant="ghost" icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shift(month, -1))} />
        <p className="text-base font-extrabold text-white">{monthName(month)}</p>
        <Button variant="ghost" icon={ChevronRight} aria-label="Next month" disabled={month >= lagosMonth()} onClick={() => setMonth(shift(month, 1))} />
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Jobs completed" value={active.reduce((s, r) => s + r.completed, 0)} hint={`${active.length} cleaners worked`} icon={Award} tone="emerald" />
            <StatCard label="Average rating" value={avgRating ? `${avgRating.toFixed(1)} ★` : "—"} hint={`${rated.reduce((s, r) => s + r.ratings, 0)} ratings`} icon={Star} tone="amber" />
            <StatCard label="On time" value={punctual.length ? `${Math.round(punctual.reduce((s, r) => s + r.onTimeRate, 0) / punctual.length)}%` : "—"} hint="Started within 15 min" icon={Clock} tone="sky" />
            <StatCard label="Complaints" value={rows.reduce((s, r) => s + r.complaints, 0)} hint="Linked to a booking" icon={ShieldAlert} tone="rose" />
          </div>

          {best && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-4 rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-300/10 to-transparent p-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-300/20 text-amber-200"><Award className="h-6 w-6" /></span>
              <div><p className="text-xs font-bold tracking-wide text-amber-200/80 uppercase">Top rated this month</p><p className="text-lg font-extrabold text-white">{best.name}</p><Stars value={best.rating} /></div>
            </motion.div>
          )}

          {!rows.length ? <Empty title="No cleaners yet" text="Add cleaners under People → Cleaners." /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <Card className={r.assigned ? "" : "opacity-60"}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-sm font-black text-emerald-300">{r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                        <div className="min-w-0"><p className="truncate font-bold text-white">{r.name}</p><p className="truncate text-xs text-white/45">{r.areas?.join(", ") || "All areas"}</p></div>
                      </div>
                      {r.status !== "active" && <Badge tone="suspended">{r.status}</Badge>}
                    </div>
                    <div className="mt-3"><Stars value={r.rating} /></div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[["Done", `${r.completed}/${r.assigned}`], ["On time", r.onTimeRate === null ? "—" : `${r.onTimeRate}%`], ["Avg time", r.avgHours === null ? "—" : `${r.avgHours}h`]].map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-white/[0.04] p-2"><dt className="text-[10px] font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 font-extrabold text-white">{v}</dd></div>
                      ))}
                    </dl>
                    <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                      <span>Jobs worth <strong className="text-white">{naira(r.value)}</strong> · earned {naira(r.earned)}</span>
                      {r.complaints > 0 && <span className="font-bold text-rose-300">{r.complaints} complaint{r.complaints > 1 ? "s" : ""}</span>}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
