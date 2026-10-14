import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { AlertCircle, CalendarCheck, ClipboardList, FileText, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { useLoad } from "../auth";
import { Badge, Card, ErrorBox, Loading, PageHeader, StatCard, naira, shortDate, time12 } from "../ui";

function JobRow({ b, onOpen, showDate }) {
  return (
    <li>
      <button onClick={() => onOpen(b.bookingId)} className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left hover:bg-white/5">
        <span className="w-16 shrink-0 text-sm font-extrabold text-emerald-300">{showDate ? shortDate(b.schedule?.date).slice(0, 6) : time12(b.schedule?.time)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-white">
            {b.customer?.firstName} {b.customer?.lastName} · {b.service}
          </span>
          <span className="block truncate text-xs text-white/50">
            {b.details?.area} · {b.assignedWorkerName || "No cleaner yet"}
          </span>
        </span>
        <Badge>{b.status}</Badge>
      </button>
    </li>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad("/admin/dashboard");
  const navigate = useNavigate();
  const open = (id) => navigate(`/admin/bookings/${id}`);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Today in Lagos · ${shortDate(data.today)}`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Today's jobs" value={data.todaysJobs.length} icon={CalendarCheck} onClick={() => navigate("/admin/calendar")} />
        <StatCard label="Revenue today" value={naira(data.revenueToday.total)} hint={`${data.revenueToday.count} payments`} icon={Wallet} />
        <StatCard label="This month" value={naira(data.revenueMonth.total)} hint={`${data.revenueMonth.count} payments`} icon={TrendingUp} tone="sky" />
        <StatCard label="New bookings (7 days)" value={data.newBookings} icon={ClipboardList} tone="sky" onClick={() => navigate("/admin/bookings")} />
        <StatCard label="Quotes sent (7 days)" value={data.newQuotes} icon={FileText} tone="sky" onClick={() => navigate("/admin/quotes")} />
        <StatCard label="New leads" value={data.newLeads} icon={UserPlus} tone="amber" />
        <StatCard label="Waiting for payment" value={data.awaitingPayment} icon={AlertCircle} tone="amber" onClick={() => navigate("/admin/bookings?paymentStatus=Pending")} />
        <StatCard label="Need a cleaner" value={data.unassigned} icon={AlertCircle} tone="rose" onClick={() => navigate("/admin/jobs")} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-extrabold text-white">Today's jobs</h2>
          {data.todaysJobs.length ? (
            <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }} className="mt-3 -mx-2">
              {data.todaysJobs.map((b) => (
                <motion.div key={b._id} variants={{ h: { opacity: 0, x: -8 }, s: { opacity: 1, x: 0 } }}>
                  <JobRow b={b} onOpen={open} />
                </motion.div>
              ))}
            </motion.ul>
          ) : (
            <p className="mt-3 text-sm text-white/50">No jobs today.</p>
          )}
        </Card>
        <Card>
          <h2 className="font-extrabold text-white">Next 7 days</h2>
          {data.upcoming.length ? (
            <ul className="mt-3 -mx-2">
              {data.upcoming.map((b) => (
                <JobRow key={b._id} b={b} onOpen={open} showDate />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-white/50">Nothing booked yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
