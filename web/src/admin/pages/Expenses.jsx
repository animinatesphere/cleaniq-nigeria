// Admin → Expense tracker: what the business spends each month (feeds profit in Analytics).
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Receipt, Trash2, TrendingDown } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Button, Card, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SearchBox, Select, StatCard, naira, shortDate, useAction } from "../ui";

const lagosToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const monthName = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const BAR = ["bg-emerald-400", "bg-sky-400", "bg-amber-400", "bg-violet-400", "bg-rose-400", "bg-teal-400", "bg-indigo-400", "bg-lime-400"];

export default function Expenses() {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const [month, setMonth] = useState(lagosToday().slice(0, 7));
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [del, setDel] = useState(null);
  const { data, error, loading, reload } = useLoad(`/admin/expenses?month=${month}&page=${page}&limit=25${category ? `&category=${encodeURIComponent(category)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const prev = useLoad(`/admin/expenses?month=${shiftMonth(month, -1)}&limit=1`);

  async function save() {
    setErrors({});
    try {
      await run(() => request(edit._id ? `/admin/expenses/${edit._id}` : "/admin/expenses", { method: edit._id ? "PATCH" : "POST", body: { date: edit.date, amount: edit.amount, category: edit.category, note: edit.note } }), "Expense saved");
      setEdit(null);
      reload();
    } catch (e) { setErrors(e.details || {}); }
  }

  const total = data?.monthTotal || 0;
  const last = prev.data?.monthTotal || 0;
  const change = last ? Math.round(((total - last) / last) * 100) : null;
  const columns = [
    { key: "date", label: "Date", render: (x) => shortDate(x.date) },
    { key: "cat", label: "Category", render: (x) => <span className="font-bold text-white">{x.category}</span> },
    { key: "note", label: "What for", render: (x) => x.note || "—" },
    { key: "amount", label: "Amount", render: (x) => <span className="font-bold">{naira(x.amount)}</span> },
    { key: "by", label: "Added by", render: (x) => x.createdBy || "—" },
    { key: "a", label: "", render: (x) => <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete" onClick={() => setDel(x)} /></div> },
  ];

  return (
    <>
      <PageHeader title="Expense tracker" subtitle="Supplies, fuel, transport, adverts, rent… Analytics takes these off your revenue to show profit."
        actions={<Button icon={Plus} onClick={() => { setErrors({}); setEdit({ date: lagosToday(), amount: "", category: "Supplies", note: "" }); }}>Add expense</Button>} />

      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-adm-card p-2">
        <Button variant="ghost" icon={ChevronLeft} aria-label="Previous month" onClick={() => { setMonth(shiftMonth(month, -1)); setPage(1); }} />
        <p className="text-base font-extrabold text-white">{monthName(month)}</p>
        <Button variant="ghost" icon={ChevronRight} aria-label="Next month" disabled={month >= lagosToday().slice(0, 7)} onClick={() => { setMonth(shiftMonth(month, 1)); setPage(1); }} />
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <StatCard label="Spent this month" value={naira(total)} hint={change === null ? "Nothing last month to compare" : `${change > 0 ? "+" : ""}${change}% vs ${monthName(shiftMonth(month, -1))}`} icon={Receipt} tone="rose" />
              <StatCard label="Biggest cost" value={data.byCategory[0]?.category || "—"} hint={data.byCategory[0] ? naira(data.byCategory[0].total) : undefined} icon={TrendingDown} tone="amber" />
            </div>
            <Card className="lg:col-span-2">
              <h2 className="mb-4 text-sm font-extrabold text-white">Where the money went</h2>
              {data.byCategory.length ? (
                <ul className="space-y-3">
                  {data.byCategory.map((c, i) => (
                    <li key={c.category}>
                      <button type="button" className="w-full text-left" onClick={() => { setCategory(category === c.category ? "" : c.category); setPage(1); }}>
                        <div className="mb-1 flex justify-between text-sm"><span className={`font-bold ${category === c.category ? "text-emerald-300" : "text-white/85"}`}>{c.category}</span><span className="text-white/60">{naira(c.total)} · {Math.round((c.total / total) * 100)}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                          <motion.div className={`h-full rounded-full ${BAR[i % BAR.length]}`} initial={{ width: 0 }} animate={{ width: `${(c.total / data.byCategory[0].total) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-white/45">No expenses this month yet.</p>}
            </Card>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Select id="exp-cat" aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} options={[{ value: "", label: "All categories" }, ...data.categories]} />
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search notes…" />
          </div>
          <DataTable columns={columns} rows={data.items} onRowClick={(x) => { setErrors({}); setEdit({ ...x }); }}
            empty={<Empty title="No expenses here" text="Add what you spend so you can see your real profit." action={<Button icon={Plus} onClick={() => setEdit({ date: lagosToday(), amount: "", category: "Supplies", note: "" })}>Add expense</Button>} />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? "Edit expense" : "Add expense"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="ex-date" label="Date *" type="date" error={errors.date} value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
            <Input id="ex-amount" label="Amount (₦) *" type="number" min="0" error={errors.amount} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
            <Select id="ex-cat" label="Category" className="sm:col-span-2" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} options={data?.categories || ["Other"]} />
            <Input id="ex-note" label="What for" className="sm:col-span-2" placeholder="e.g. Mop heads and bleach — Shoprite Lekki" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmModal open={Boolean(del)} onClose={() => setDel(null)} danger loading={busy} title="Delete this expense?" text="It moves to the Bin and can be restored from there." confirmLabel="Delete"
        onConfirm={() => run(() => request(`/admin/expenses/${del._id}`, { method: "DELETE" }), "Expense deleted").then(() => { setDel(null); reload(); }).catch(() => {})} />
    </>
  );
}
