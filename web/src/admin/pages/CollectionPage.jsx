// One page design for the simple list pages (to-do, tasks, complaints, contracts, checklist, coupons,
// referrals, commission, commercial hub, property report/condition, guides, campaigns, cold email,
// org chart, AI knowledge). Fields, statuses and permissions come from the server: GET /admin/c/types.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import {
  Badge, Button, Card, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination,
  SearchBox, Select, StatCard, TextArea, dateTime, naira, shortDate, useAction,
} from "../ui";

const TONES = ["sky", "amber", "emerald", "rose"];
const STATUS_TONE = {
  Done: "Completed", "To do": "Pending", Open: "Pending", Investigating: "Confirmed", "Re-clean booked": "Assigned", Resolved: "Completed",
  Draft: "Expired", Active: "Paid", Ended: "Refunded", Paused: "Pending", Expired: "Expired", Invited: "Confirmed", Booked: "Assigned", Rewarded: "Completed",
  Prospect: "Confirmed", Client: "Completed", Former: "Refunded", Good: "Completed", Fair: "Pending", Poor: "Cancelled", "No damage": "Completed", "Damage found": "Cancelled",
  Sent: "Completed", High: "Cancelled", Normal: "Confirmed", Low: "Expired",
};

function show(field, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return field.key === "items" || field.key === "emails" ? `${value.length} ${field.key === "emails" ? "email" : "item"}${value.length === 1 ? "" : "s"}` : value.join(", ");
  if (field.type === "money") return naira(value);
  if (field.type === "date") return shortDate(value);
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.key === "percent") return `${value}%`;
  return String(value);
}

function blank(def) {
  return Object.fromEntries(def.fields.map((f) => [f.key, f.type === "list" ? "" : f.default ?? (f.type === "boolean" ? false : "")]));
}
const toForm = (def, data) => Object.fromEntries(def.fields.map((f) => [f.key, f.type === "list" ? (data[f.key] || []).join("\n") : data[f.key] ?? ""]));

export function Field({ f, value, error, onChange, prefix = "f" }) {
  const id = `${prefix}-${f.key}`;
  const label = `${f.label}${f.required ? " *" : ""}`;
  if (f.type === "select") return <Select id={id} label={label} error={error} options={f.options} value={value} onChange={(e) => onChange(e.target.value)} disabled={f.readOnly} />;
  if (f.type === "textarea" || f.type === "list") return <TextArea id={id} label={label} error={error} value={value} onChange={(e) => onChange(e.target.value)} className="sm:col-span-2" rows={f.type === "list" ? 5 : 4} />;
  const type = { date: "date", number: "number", money: "number", email: "email", url: "url", phone: "tel" }[f.type] || "text";
  return <Input id={id} label={label} error={error} type={type} value={value} onChange={(e) => onChange(f.type === "code" ? e.target.value.toUpperCase() : e.target.value)} min={f.min} max={f.max} />;
}

export default function CollectionPage({ type, title, subtitle, icon: Icon, view = "table", embedded = false }) {
  const { request, admin } = useAuth();
  const [run, busy] = useAction();
  const types = useLoad("/admin/c/types");
  const def = types.data?.types?.[type];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useLoad(`/admin/c/${type}?page=${page}&limit=${view === "org" ? 100 : 25}${status ? `&status=${encodeURIComponent(status)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [edit, setEdit] = useState(null); // { id?, form }
  const [errors, setErrors] = useState({});
  const [del, setDel] = useState(null);
  const [send, setSend] = useState(null); // { item, recipients }

  const canWrite = def?.write?.includes(admin.role);
  const fieldsByKey = useMemo(() => Object.fromEntries((def?.fields || []).map((f) => [f.key, f])), [def]);

  if (types.error) return <ErrorBox error={types.error} onRetry={types.reload} />;
  if (!def) return <Loading />;

  const open = (item) => { setErrors({}); setEdit(item ? { id: item._id, item, form: toForm(def, item.data) } : { form: blank(def) }); };
  const body = () => Object.fromEntries(def.fields.filter((f) => !f.readOnly).map((f) => [f.key, f.type === "list" ? String(edit.form[f.key] || "").split("\n") : edit.form[f.key]]));
  async function save() {
    setErrors({});
    try {
      await run(() => request(edit.id ? `/admin/c/${type}/${edit.id}` : `/admin/c/${type}`, { method: edit.id ? "PATCH" : "POST", body: body() }), `${def.singular} saved`);
      setEdit(null);
      list.reload();
    } catch (e) { setErrors(e.details || {}); }
  }
  async function quickStatus(item, value) {
    await run(() => request(`/admin/c/${type}/${item._id}`, { method: "PATCH", body: { [def.statusField]: value } }), `Marked ${value.toLowerCase()}`).catch(() => {});
    list.reload();
  }
  async function remove() {
    await run(() => request(`/admin/c/${type}/${del._id}`, { method: "DELETE" }), "Moved to the Bin").catch(() => {});
    setDel(null);
    list.reload();
  }
  async function openSend(item) {
    const r = await run(() => request(`/admin/c/${type}/${item._id}/recipients`)).catch(() => null);
    if (r) setSend({ item, recipients: r });
  }
  async function doSend() {
    const r = await run(() => request(`/admin/c/${type}/${send.item._id}/send`, { method: "POST", body: { again: Boolean(send.item.sent?.at) } })).catch(() => null);
    if (r) { setSend({ ...send, done: r }); list.reload(); }
  }

  const counts = list.data?.counts || {};
  const columns = def.columns.map((k, i) => {
    const f = fieldsByKey[k];
    return {
      key: k, label: f.label.replace(/ \(.*\)$/, ""),
      render: (x) => (k === def.statusField ? <Badge tone={STATUS_TONE[x.data[k]]}>{x.data[k]}</Badge> : i === 0 ? <span className="font-bold text-white">{show(f, x.data[k])}</span> : show(f, x.data[k])),
    };
  });
  columns.push({
    key: "actions", label: "",
    render: (x) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {def.canSend && canWrite && <Button size="sm" variant={x.sent?.at ? "secondary" : "primary"} icon={Send} onClick={() => openSend(x)}>{x.sent?.at ? "Resend" : "Send"}</Button>}
        {type === "todo" && x.data.status !== "Done" && canWrite && <Button size="sm" variant="secondary" icon={Check} onClick={() => quickStatus(x, "Done")}>Done</Button>}
        {canWrite && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete" onClick={() => setDel(x)} />}
      </div>
    ),
  });

  const items = list.data?.items || [];
  const Header = embedded ? ({ title: t, subtitle: s, actions }) => (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-white">{t}</h2>{s && <p className="text-sm text-white/55">{s}</p>}</div>{actions}</div>
  ) : PageHeader;

  return (
    <>
      <Header title={title || def.label} subtitle={subtitle} actions={canWrite && <Button icon={Plus} onClick={() => open(null)}>Add {def.singular.toLowerCase()}</Button>} />

      {def.statuses.length > 0 && view !== "org" && (
        <div className={`mb-5 grid gap-3 grid-cols-2 ${def.statuses.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {def.statuses.slice(0, 4).map((s, i) => (
            <StatCard key={s} label={s} value={counts[s] || 0} icon={Icon} tone={TONES[i % 4]} onClick={() => { setStatus(status === s ? "" : s); setPage(1); }} hint={status === s ? "Showing only these — tap to show all" : undefined} />
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {def.statuses.length > 0 && view !== "org" ? (
          <div className="flex flex-wrap gap-2">
            {["", ...def.statuses].map((s) => (
              <button key={s || "all"} type="button" onClick={() => { setStatus(s); setPage(1); }}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${status === s ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>
                {s || "All"}
              </button>
            ))}
          </div>
        ) : <span />}
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={`Search ${def.label.toLowerCase()}…`} />
      </div>

      {list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Loading /> : view === "org" ? (
        <OrgChart items={items} onOpen={canWrite ? open : undefined} empty={<Empty title="No team members yet" text="Add your team to see who reports to whom." action={canWrite && <Button icon={Plus} onClick={() => open(null)}>Add team member</Button>} />} />
      ) : (
        <>
          <DataTable columns={columns} rows={items} onRowClick={canWrite ? open : undefined}
            empty={<Empty title={`No ${def.label.toLowerCase()} yet`} text={canWrite ? `Add your first ${def.singular.toLowerCase()} — it'll show up here.` : "Nothing here yet."} action={canWrite && <Button icon={Plus} onClick={() => open(null)}>Add {def.singular.toLowerCase()}</Button>} />} />
          <Pagination page={page} total={list.data.total} limit={list.data.limit} onPage={setPage} />
        </>
      )}

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} wide title={edit?.id ? `Edit ${def.singular.toLowerCase()}` : `New ${def.singular.toLowerCase()}`}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button icon={edit?.id ? Pencil : Plus} loading={busy} onClick={save}>{edit?.id ? "Save changes" : "Save"}</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.filter((f) => !(f.readOnly && !edit.id)).map((f) => (
              <Field key={f.key} f={f} value={edit.form[f.key]} error={errors[f.key]} onChange={(v) => setEdit({ ...edit, form: { ...edit.form, [f.key]: v } })} />
            ))}
            {edit.item && <p className="text-xs text-white/40 sm:col-span-2">Added by {edit.item.createdBy || "—"} · {dateTime(edit.item.createdAt)}{edit.item.sent?.at ? ` · sent ${edit.item.sent.count}× (last ${dateTime(edit.item.sent.at)})` : ""}</p>}
          </div>
        )}
      </Modal>

      <ConfirmModal open={Boolean(del)} onClose={() => setDel(null)} onConfirm={remove} danger loading={busy}
        title={`Delete this ${def.singular.toLowerCase()}?`} text="It moves to the Bin and can be restored from there." confirmLabel="Delete" />

      <Modal open={Boolean(send)} onClose={() => setSend(null)} title={send?.done ? "Sent" : `Send "${send?.item?.title}"`}
        footer={send && !send.done ? <><Button variant="ghost" onClick={() => setSend(null)}>Cancel</Button><Button icon={Send} loading={busy} disabled={!send.recipients.count} onClick={doSend}>Send to {send.recipients.count}</Button></> : <Button onClick={() => setSend(null)}>Close</Button>}>
        {send && (send.done ? (
          <p className="text-white/80">Sent to <strong className="text-white">{send.done.sent}</strong> of {send.done.of} people.</p>
        ) : (
          <div className="space-y-3 text-sm text-white/75">
            <p>This will email <strong className="text-white">{send.recipients.count}</strong> {send.recipients.count === 1 ? "person" : "people"}{send.recipients.count >= send.recipients.max ? ` (max ${send.recipients.max} at a time)` : ""}.</p>
            {send.recipients.sample?.length > 0 && <p className="text-white/50">e.g. {send.recipients.sample.join(", ")}</p>}
            {send.item.sent?.at && <p className="rounded-xl bg-amber-400/10 p-3 text-amber-200">Already sent {send.item.sent.count}× — last {dateTime(send.item.sent.at)}. Sending again emails everyone again.</p>}
          </div>
        ))}
      </Modal>
    </>
  );
}

// Organisation chart: people grouped by who they report to, top of the tree first.
function OrgChart({ items, onOpen, empty }) {
  if (!items.length) return empty;
  const byName = new Map(items.map((p) => [p.data.name.toLowerCase(), p]));
  const kids = new Map();
  const roots = [];
  for (const p of items) {
    const boss = byName.get(String(p.data.reportsTo || "").toLowerCase());
    if (boss && boss !== p) {
      if (!kids.has(boss._id)) kids.set(boss._id, []);
      kids.get(boss._id).push(p);
    } else roots.push(p);
  }
  // Guard against loops ("A reports to B, B reports to A"): each person is drawn once.
  const drawn = new Set();
  const node = (p, depth) => {
    if (drawn.has(p._id)) return null;
    drawn.add(p._id);
    return (
    <div key={p._id} className={depth ? "border-l border-white/10 pl-4 sm:pl-6" : ""}>
      <motion.button type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => onOpen?.(p)} disabled={!onOpen}
        className="mb-3 flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/8 bg-adm-card p-4 text-left transition hover:border-emerald-400/40">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-sm font-black text-emerald-300">
          {p.data.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold text-white">{p.data.name}</span>
          <span className="block truncate text-sm text-white/60">{p.data.role}</span>
          <span className="mt-1 inline-block rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold text-white/55">{p.data.department}</span>
        </span>
      </motion.button>
      {(kids.get(p._id) || []).map((k) => node(k, depth + 1))}
    </div>
    );
  };
  const tree = roots.map((p) => node(p, 0));
  const rest = items.filter((p) => !drawn.has(p._id)).map((p) => node(p, 0));
  return <Card className="overflow-x-auto">{tree}{rest}</Card>;
}
