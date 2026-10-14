// Admin → Leads (list) and Pipeline (board): every enquiry, from first contact to won or lost.
import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Mail, MessageSquarePlus, Phone, Plus, Trash2, Trophy, UserPlus, XCircle } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import {
  Badge, Button, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SearchBox, Select,
  StatCard, TextArea, dateTime, naira, shortDate, useAction,
} from "../ui";

export const STAGES = [
  { key: "new", label: "New", tone: "Confirmed", ring: "border-sky-400/40", dot: "bg-sky-400" },
  { key: "contacted", label: "Contacted", tone: "Assigned", ring: "border-indigo-400/40", dot: "bg-indigo-400" },
  { key: "quoted", label: "Quoted", tone: "Pending", ring: "border-amber-400/40", dot: "bg-amber-400" },
  { key: "won", label: "Won", tone: "Paid", ring: "border-emerald-400/40", dot: "bg-emerald-400" },
  { key: "lost", label: "Lost", tone: "Cancelled", ring: "border-rose-400/40", dot: "bg-rose-400" },
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s]));
const SOURCE_LABEL = { website: "Website", booking: "Booking", quote: "Quote", contact: "Contact form", whatsapp: "WhatsApp", phone: "Phone", instagram: "Instagram", referral: "Referral", admin: "Added by team", other: "Other" };
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);

export default function Leads({ board = false }) {
  const { request } = useAuth();
  const [run] = useAction();
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [lead, setLead] = useState(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(null);
  const path = board
    ? `/admin/leads?board=1${q ? `&q=${encodeURIComponent(q)}` : ""}${source ? `&source=${source}` : ""}`
    : `/admin/leads?page=${page}&limit=25${stage ? `&stage=${stage}` : ""}${source ? `&source=${source}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const { data, error, loading, reload } = useLoad(path);
  const counts = data?.counts || {};

  async function move(l, to) {
    if (l.stage === to) return;
    await run(() => request(`/admin/leads/${l._id}`, { method: "PATCH", body: { stage: to } }), `Moved to ${STAGE[to].label}`).catch(() => {});
    reload();
  }

  const won = counts.won?.count || 0;
  const lost = counts.lost?.count || 0;
  const open = ["new", "contacted", "quoted"].reduce((s, k) => s + (counts[k]?.count || 0), 0);

  const columns = [
    { key: "name", label: "Name", render: (l) => <span><span className="font-bold text-white">{l.name || "—"}</span><span className="block text-xs text-white/45">{l.email || l.phone}</span></span> },
    { key: "source", label: "Came from", render: (l) => SOURCE_LABEL[l.source] || l.source },
    { key: "area", label: "Area", render: (l) => l.area || "—" },
    { key: "value", label: "Worth", render: (l) => (l.value ? naira(l.value) : "—") },
    { key: "follow", label: "Follow up", render: (l) => (l.followUpDate ? <span className={l.followUpDate <= today() && !["won", "lost"].includes(l.stage) ? "font-bold text-amber-300" : ""}>{shortDate(l.followUpDate)}</span> : "—") },
    { key: "stage", label: "Stage", render: (l) => <Badge tone={STAGE[l.stage]?.tone}>{STAGE[l.stage]?.label || l.stage}</Badge> },
    { key: "when", label: "Updated", render: (l) => dateTime(l.updatedAt) },
  ];

  const Filters = (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {!board ? (
        <div className="flex flex-wrap gap-2">
          {[{ key: "", label: "All" }, ...STAGES].map((s) => (
            <button key={s.key || "all"} type="button" onClick={() => { setStage(s.key); setPage(1); }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${stage === s.key ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>
              {s.label}{s.key && counts[s.key]?.count ? ` · ${counts[s.key].count}` : ""}
            </button>
          ))}
        </div>
      ) : <p className="text-sm text-white/50">Drag a card to another column, or open it to change the stage.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select id="lead-source" aria-label="Came from" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} options={[{ value: "", label: "All sources" }, ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))]} />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, phone, email…" />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title={board ? "Pipeline" : "Leads"} subtitle={board ? "Where every enquiry is, from first contact to booked." : "Everyone who's asked about a clean — website, WhatsApp, calls, Instagram, quotes and bookings."}
        actions={<Button icon={UserPlus} onClick={() => setAdding(true)}>Add lead</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open leads" value={open} hint={naira(["new", "contacted", "quoted"].reduce((s, k) => s + (counts[k]?.value || 0), 0)) + " possible"} icon={UserPlus} tone="sky" />
        <StatCard label="New — not contacted" value={counts.new?.count || 0} icon={Phone} tone="amber" onClick={board ? undefined : () => { setStage("new"); setPage(1); }} />
        <StatCard label="Won" value={won} hint={naira(counts.won?.value)} icon={Trophy} tone="emerald" onClick={board ? undefined : () => { setStage("won"); setPage(1); }} />
        <StatCard label="Win rate" value={won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"} hint={`${lost} lost`} icon={XCircle} tone="rose" />
      </div>

      {Filters}

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : board ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1100px] grid-cols-5 gap-3">
            {STAGES.map((s) => {
              const items = data.items.filter((l) => l.stage === s.key);
              return (
                <section key={s.key} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragging) move(dragging, s.key); setDragging(null); }}
                  className={`flex min-h-64 flex-col rounded-2xl border bg-adm-card/60 p-3 ${dragging && dragging.stage !== s.key ? s.ring : "border-white/8"}`}>
                  <header className="mb-3 flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-2 text-sm font-extrabold text-white"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</h2>
                    <span className="text-xs font-bold text-white/45">{items.length}{counts[s.key]?.value ? ` · ${naira(counts[s.key].value)}` : ""}</span>
                  </header>
                  <div className="flex flex-1 flex-col gap-2">
                    {items.map((l) => (
                      <motion.button layout key={l._id} type="button" draggable onDragStart={() => setDragging(l)} onDragEnd={() => setDragging(null)} onClick={() => setLead(l)}
                        className="cursor-grab rounded-xl border border-white/8 bg-adm-bg p-3 text-left transition hover:border-emerald-400/40 active:cursor-grabbing">
                        <p className="truncate font-bold text-white">{l.name || l.email || l.phone}</p>
                        <p className="mt-0.5 truncate text-xs text-white/50">{[SOURCE_LABEL[l.source], l.area].filter(Boolean).join(" · ")}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-emerald-300">{l.value ? naira(l.value) : ""}</span>
                          {l.followUpDate && <span className={`flex items-center gap-1 ${l.followUpDate <= today() ? "text-amber-300" : "text-white/45"}`}><CalendarClock className="h-3 w-3" />{shortDate(l.followUpDate)}</span>}
                        </div>
                      </motion.button>
                    ))}
                    {!items.length && <p className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/30">Drop here</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} onRowClick={setLead}
            empty={<Empty title="No leads yet" text="Enquiries from the website, quotes and bookings land here automatically. Add calls and WhatsApp chats yourself." action={<Button icon={UserPlus} onClick={() => setAdding(true)}>Add lead</Button>} />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}

      <LeadDrawer lead={lead} onClose={() => setLead(null)} onChanged={(l) => { setLead(l); reload(); }} onDeleted={() => { setLead(null); reload(); }} />
      <AddLead open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
    </>
  );
}

function LeadDrawer({ lead, onClose, onChanged, onDeleted }) {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [note, setNote] = useState("");
  const [del, setDel] = useState(false);
  const [edit, setEdit] = useState(null);
  if (!lead) return null;
  const patch = (body, msg) => run(() => request(`/admin/leads/${lead._id}`, { method: "PATCH", body }), msg).then((r) => onChanged(r.lead)).catch(() => {});
  const v = edit || { followUpDate: lead.followUpDate || "", value: lead.value ?? "", area: lead.area || "", phone: lead.phone || "" };

  return (
    <>
      <Modal open onClose={() => { setEdit(null); onClose(); }} wide title={lead.name || lead.email || "Lead"}
        footer={<>
          {can("owner", "manager") && <Button variant="ghost" icon={Trash2} onClick={() => setDel(true)}>Delete</Button>}
          {edit && <Button loading={busy} onClick={() => patch(edit, "Saved").then(() => setEdit(null))}>Save details</Button>}
        </>}>
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button key={s.key} type="button" disabled={busy} onClick={() => lead.stage !== s.key && patch({ stage: s.key }, `Moved to ${s.label}`)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${lead.stage === s.key ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {lead.phone && <a className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 font-bold text-white hover:bg-white/15" href={`tel:${lead.phone}`}><Phone className="h-4 w-4" />Call</a>}
            {lead.phone && <a className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 font-bold text-white hover:bg-white/15" target="_blank" rel="noreferrer" href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}>WhatsApp</a>}
            {lead.email && <a className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 font-bold text-white hover:bg-white/15" href={`mailto:${lead.email}`}><Mail className="h-4 w-4" />Email</a>}
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[["Email", lead.email], ["Came from", SOURCE_LABEL[lead.source] || lead.source], ["Reference", lead.ref], ["Added", dateTime(lead.createdAt)]].filter(([, x]) => x).map(([k, x]) => (
              <div key={k}><dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 break-words text-white/85">{x}</dd></div>
            ))}
          </dl>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input id="ld-phone" label="Phone" value={v.phone} onChange={(e) => setEdit({ ...v, phone: e.target.value })} />
            <Input id="ld-area" label="Area" value={v.area} onChange={(e) => setEdit({ ...v, area: e.target.value })} />
            <Input id="ld-value" label="Worth (₦)" type="number" min="0" value={v.value} onChange={(e) => setEdit({ ...v, value: e.target.value })} />
            <Input id="ld-follow" label="Follow up on" type="date" value={v.followUpDate} onChange={(e) => setEdit({ ...v, followUpDate: e.target.value })} />
          </div>
          {lead.message && <blockquote className="rounded-2xl bg-white/[0.04] p-4 whitespace-pre-wrap text-white/75">{lead.message}</blockquote>}
          <div>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-white/50 uppercase">Notes</h3>
            <ol className="mb-3 space-y-2">
              {(lead.notes || []).slice().reverse().map((n, i) => (
                <li key={i} className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-white/85">{n.text}</p><p className="mt-0.5 text-xs text-white/40">{n.by} · {dateTime(n.at)}</p></li>
              ))}
              {!lead.notes?.length && <li className="text-white/40">No notes yet.</li>}
            </ol>
            <div className="flex gap-2">
              <Input id="ld-note" aria-label="New note" className="flex-1" placeholder="e.g. Called — wants a quote for a 4-bed duplex" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button icon={MessageSquarePlus} loading={busy} disabled={!note.trim()} onClick={() => run(() => request(`/admin/leads/${lead._id}/notes`, { method: "POST", body: { text: note } }), "Note added").then((r) => { setNote(""); onChanged(r.lead); }).catch(() => {})}>Add</Button>
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmModal open={del} onClose={() => setDel(false)} danger loading={busy} title="Delete this lead?" text="It moves to the Bin and can be restored from there." confirmLabel="Delete"
        onConfirm={() => run(() => request(`/admin/leads/${lead._id}`, { method: "DELETE" }), "Lead moved to the Bin").then(() => { setDel(false); onDeleted(); }).catch(() => {})} />
    </>
  );
}

function AddLead({ open, onClose, onDone }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const empty = { name: "", phone: "", email: "", area: "", source: "whatsapp", stage: "new", value: "", followUpDate: "", message: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setErrors({});
    try {
      await run(() => request("/admin/leads", { method: "POST", body: f }), "Lead added");
      setF(empty);
      onDone();
    } catch (e) { setErrors(e.details || {}); }
  }
  return (
    <Modal open={open} onClose={onClose} wide title="Add a lead" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon={Plus} loading={busy} onClick={save}>Add lead</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="al-name" label="Name *" error={errors.name} value={f.name} onChange={(e) => set("name", e.target.value)} />
        <Input id="al-phone" label="Phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <Input id="al-email" label="Email" type="email" error={errors.email} hint="Add a phone or an email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        <Input id="al-area" label="Area" placeholder="e.g. Ikeja GRA" value={f.area} onChange={(e) => set("area", e.target.value)} />
        <Select id="al-source" label="Came from" value={f.source} onChange={(e) => set("source", e.target.value)} options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} />
        <Select id="al-stage" label="Stage" value={f.stage} onChange={(e) => set("stage", e.target.value)} options={STAGES.map((s) => ({ value: s.key, label: s.label }))} />
        <Input id="al-value" label="Worth (₦, estimate)" type="number" min="0" value={f.value} onChange={(e) => set("value", e.target.value)} />
        <Input id="al-follow" label="Follow up on" type="date" error={errors.followUpDate} value={f.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} />
        <TextArea id="al-msg" label="What they asked for" className="sm:col-span-2" value={f.message} onChange={(e) => set("message", e.target.value)} />
      </div>
    </Modal>
  );
}
