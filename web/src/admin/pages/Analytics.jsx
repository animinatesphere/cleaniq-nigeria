// Admin → Analytics: company revenue, profit and where the money comes from (Lagos time).
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, CalendarRange, PiggyBank, Repeat, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { useLoad } from "../auth";
import { Card, ErrorBox, Loading, PageHeader, StatCard, naira } from "../ui";

const COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#a78bfa", "#fb7185", "#2dd4bf", "#818cf8", "#a3e635"];
const short = (n) => (Math.abs(n) >= 1e6 ? `₦${(n / 1e6).toFixed(1)}m` : Math.abs(n) >= 1e3 ? `₦${Math.round(n / 1e3)}k` : `₦${n}`);
const monthLabel = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const dayLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const axis = { stroke: "rgba(255,255,255,0.35)", fontSize: 11, tickLine: false, axisLine: false };

function ChartTip({ active, payload, label, labelFormat = (x) => x }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-adm-bg/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-bold text-white">{labelFormat(label)}</p>
      {payload.map((p) => <p key={p.dataKey || p.name} style={{ color: p.color || p.payload?.fill }}>{p.name}: <strong>{naira(p.value)}</strong></p>)}
    </div>
  );
}

function Section({ title, text, children, className = "" }) {
  return (
    <Card className={className}>
      <h2 className="text-sm font-extrabold text-white">{title}</h2>
      {text && <p className="mt-0.5 text-xs text-white/45">{text}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Ranked({ rows }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-white/40">No paid jobs yet.</p>;
  const top = rows[0].total || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-bold text-white/85">{r.name}</span><span className="shrink-0 text-white/60">{naira(r.total)}{r.count ? ` · ${r.count}` : ""}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full" style={{ width: `${(r.total / top) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Analytics() {
  const [months, setMonths] = useState(12);
  const { data, error, loading, reload } = useLoad(`/admin/analytics?months=${months}`);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Revenue, costs and profit — money in after refunds, minus expenses and cleaners' pay."
        actions={
          <div className="flex rounded-xl bg-white/5 p-1">
            {[3, 6, 12, 24].map((m) => (
              <button key={m} type="button" onClick={() => setMonths(m)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${months === m ? "bg-emerald-400 text-adm-bg" : "text-white/70 hover:text-white"}`}>
                {m === 24 ? "2 yrs" : `${m} mo`}
              </button>
            ))}
          </div>
        } />

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Revenue this month" value={naira(data.thisMonth.revenue)} icon={data.thisMonth.growth < 0 ? TrendingDown : TrendingUp} tone={data.thisMonth.growth < 0 ? "rose" : "emerald"}
              hint={data.thisMonth.growth === null ? `Last month ${naira(data.thisMonth.lastMonthRevenue)}` : `${data.thisMonth.growth > 0 ? "+" : ""}${data.thisMonth.growth}% vs last month`} />
            <StatCard label="Profit this month" value={naira(data.thisMonth.profit)} hint={`${naira(data.thisMonth.expenses)} expenses · ${naira(data.thisMonth.staffPay)} staff pay`} icon={PiggyBank} tone={data.thisMonth.profit < 0 ? "rose" : "sky"} />
            <StatCard label="Monthly plans" value={naira(data.plans.monthly)} hint={`${data.plans.count} plans · every month`} icon={Repeat} tone="amber" />
            <StatCard label="Waiting to be paid" value={naira(data.outstanding.due + data.outstanding.overdue)} hint={`${naira(data.outstanding.overdue)} overdue (${data.outstanding.overdueCount})`} icon={Wallet} tone="rose" />
          </div>

          <Section title="Revenue and profit by month" text={`${naira(data.totals.revenue)} revenue · ${naira(data.totals.profit)} profit over ${months} months`}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.45} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                    <linearGradient id="pro" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
                  <YAxis tickFormatter={short} width={56} {...axis} />
                  <Tooltip content={<ChartTip labelFormat={monthLabel} />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#34d399" strokeWidth={2.5} fill="url(#rev)" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#38bdf8" strokeWidth={2} fill="url(#pro)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Last 30 days" text="Money received each day">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.days} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} interval={6} {...axis} />
                    <YAxis tickFormatter={short} width={52} {...axis} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTip labelFormat={dayLabel} />} />
                    <Bar dataKey="revenue" name="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
            <Section title="Costs by month" text="Expenses and cleaners’ pay">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
                    <YAxis tickFormatter={short} width={52} {...axis} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTip labelFormat={monthLabel} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="expenses" name="Expenses" stackId="c" fill="#fb7185" />
                    <Bar dataKey="staffPay" name="Staff pay" stackId="c" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="How customers paid" text="Pay now, after the clean, weekly, monthly plan, links">
              {data.bySource.length ? (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.bySource} dataKey="total" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                        {data.bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="py-8 text-center text-sm text-white/40">No payments yet.</p>}
            </Section>
            <Section title="Top services" text="Paid bookings"><Ranked rows={data.byService} /></Section>
            <Section title="Top areas" text="Paid bookings"><Ranked rows={data.byArea} /></Section>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Average payment" value={naira(data.averageJob)} icon={Banknote} tone="sky" />
            <StatCard label="Jobs completed" value={data.totals.jobs} hint={`${data.thisMonth.jobs} this month`} icon={CalendarRange} tone="emerald" />
            <StatCard label="Customers" value={data.customers.total} hint={`${data.customers.newThisMonth} new this month`} icon={Users} tone="amber" />
            <StatCard label="Come back again" value={`${data.customers.repeatRate}%`} hint="Customers with 2+ bookings" icon={Repeat} tone="sky" />
          </div>

          <Section title="Month by month">
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs tracking-wide text-white/45 uppercase">{["Month", "Revenue", "Refunds", "Expenses", "Staff pay", "Profit", "Jobs"].map((h) => <th key={h} className="pb-2 font-bold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/5">
                  {data.monthly.slice().reverse().map((m) => (
                    <tr key={m.month} className="text-white/80">
                      <td className="py-2 font-bold text-white">{monthLabel(m.month)}</td><td>{naira(m.revenue)}</td><td>{m.refunds ? `−${naira(m.refunds)}` : "—"}</td>
                      <td>{naira(m.expenses)}</td><td>{naira(m.staffPay)}</td><td className={`font-bold ${m.profit < 0 ? "text-rose-300" : "text-emerald-300"}`}>{naira(m.profit)}</td><td>{m.jobs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
