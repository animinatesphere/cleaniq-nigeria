// Admin → Blog: write, schedule and publish posts; draft with Claude; autopilot writes posts every few days.
import { useRef, useState } from "react";
import { CalendarClock, Eye, FileText, Heading2, ImageIcon, Link2, List, PenLine, Plus, Rocket, Trash2, Wand2 } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import {
  Badge, Button, Card, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SearchBox, Select,
  StatCard, TextArea, Toggle, dateTime, useAction,
} from "../ui";

const STATUS = { draft: { label: "Draft", tone: "Expired" }, scheduled: { label: "Scheduled", tone: "Confirmed" }, published: { label: "Published", tone: "Paid" } };
const at9 = (days) => { const d = new Date(Date.now() + 3600e3); d.setUTCDate(d.getUTCDate() + days); return `${d.toISOString().slice(0, 10)}T09:00`; };
const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 16) : "");
const fromLagosInput = (v) => new Date(`${v}:00+01:00`).toISOString();

export default function Blog() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [post, setPost] = useState(null);
  const [del, setDel] = useState(null);
  const [auto, setAuto] = useState(false);
  const { data, error, loading, reload } = useLoad(`/admin/blog?page=${page}&limit=20${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const c = data?.counts || {};

  const open = async (p) => setPost(p ? (await request(`/admin/blog/${p._id}`)).post : {});
  const columns = [
    { key: "t", label: "Post", render: (p) => (
      <span className="flex items-center gap-3">
        {p.coverImage ? <img src={p.coverImage} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : <span className="grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-white/5"><FileText className="h-4 w-4 text-white/30" /></span>}
        <span className="min-w-0"><span className="block truncate font-bold text-white">{p.title}</span><span className="block truncate text-xs text-white/45">/blog/{p.slug}</span></span>
      </span>
    ) },
    { key: "s", label: "Status", render: (p) => <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge> },
    { key: "w", label: "When", render: (p) => (p.status === "scheduled" ? `Goes live ${dateTime(p.publishAt)}` : p.status === "published" ? dateTime(p.publishedAt) : `Edited ${dateTime(p.updatedAt)}`) },
    { key: "a", label: "Author", render: (p) => p.author || "—" },
    { key: "d", label: "", render: (p) => can("owner", "manager") && <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete" onClick={() => setDel(p)} /></div> },
  ];

  return (
    <>
      <PageHeader title="Blog" subtitle="Posts for the website — helpful cleaning tips bring people in from Google."
        actions={<>{can("owner", "manager") && <Button variant="secondary" icon={Rocket} onClick={() => setAuto(true)}>Autopilot{data?.autopilot?.enabled ? " · on" : ""}</Button>}<Button icon={Plus} onClick={() => open(null)}>New post</Button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Published" value={c.published || 0} icon={Eye} tone="emerald" onClick={() => { setStatus("published"); setPage(1); }} />
        <StatCard label="Scheduled" value={c.scheduled || 0} icon={CalendarClock} tone="sky" onClick={() => { setStatus("scheduled"); setPage(1); }} />
        <StatCard label="Drafts" value={c.draft || 0} icon={PenLine} tone="amber" onClick={() => { setStatus("draft"); setPage(1); }} />
        <StatCard label="Autopilot" value={data?.autopilot?.enabled ? `Every ${data.autopilot.everyDays}d` : "Off"} hint={data?.aiReady ? "Claude connected" : "Claude not connected"} icon={Rocket} tone="rose" onClick={can("owner", "manager") ? () => setAuto(true) : undefined} />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["", "published", "scheduled", "draft"].map((s) => (
            <button key={s || "all"} type="button" onClick={() => { setStatus(s); setPage(1); }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${status === s ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>{s ? STATUS[s].label : "All"}</button>
          ))}
        </div>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search posts…" />
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} onRowClick={open}
            empty={<Empty title="No posts yet" text="Write your first post, or let Claude draft one for you." action={<Button icon={Plus} onClick={() => open(null)}>New post</Button>} />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
      {post && <Editor initial={post} aiReady={data?.aiReady} onClose={() => setPost(null)} onSaved={() => { setPost(null); reload(); }} />}
      {auto && data && <Autopilot initial={data.autopilot} aiReady={data.aiReady} onClose={() => setAuto(false)} onSaved={() => { setAuto(false); reload(); }} />}
      <ConfirmModal open={Boolean(del)} onClose={() => setDel(null)} danger loading={busy} title="Delete this post?" text="It comes off the website and moves to the Bin." confirmLabel="Delete"
        onConfirm={() => run(() => request(`/admin/blog/${del._id}`, { method: "DELETE" }), "Post moved to the Bin").then(() => { setDel(null); reload(); }).catch(() => {})} />
    </>
  );
}

function Editor({ initial, aiReady, onClose, onSaved }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const editing = Boolean(initial._id);
  const [f, setF] = useState({
    title: initial.title || "", slug: initial.slug || "", excerpt: initial.excerpt || "", body: initial.body || "", coverImage: initial.coverImage || "",
    tags: (initial.tags || []).join(", "), seo: { title: initial.seo?.title || "", description: initial.seo?.description || "" },
    when: initial.status === "scheduled" ? "schedule" : initial.status === "published" ? "now" : "draft", publishAt: toLocalInput(initial.publishAt) || at9(1),
  });
  const [errors, setErrors] = useState({});
  const [ai, setAi] = useState({ open: !editing && aiReady, topic: "", instructions: "" });
  const [link, setLink] = useState(null);
  const body = useRef(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  function insert(before, after = "", placeholder = "") {
    const el = body.current?.querySelector("textarea");
    const start = el?.selectionStart ?? f.body.length;
    const end = el?.selectionEnd ?? f.body.length;
    const chosen = f.body.slice(start, end) || placeholder;
    set("body", f.body.slice(0, start) + before + chosen + after + f.body.slice(end));
  }
  async function draft() {
    const r = await run(() => request("/admin/blog/draft", { method: "POST", body: { topic: ai.topic, instructions: ai.instructions } }), "Draft ready — read it through before publishing").catch(() => null);
    if (r) { setF((x) => ({ ...x, title: r.draft.title, excerpt: r.draft.excerpt, body: r.draft.body, tags: r.draft.tags.join(", ") })); setAi({ ...ai, open: false }); }
  }
  async function save() {
    setErrors({});
    const payload = {
      title: f.title, excerpt: f.excerpt, body: f.body, coverImage: f.coverImage, tags: f.tags, seo: f.seo, slug: f.slug || undefined,
      status: f.when === "now" ? "published" : f.when === "schedule" ? "scheduled" : "draft", publishAt: f.when === "schedule" ? fromLagosInput(f.publishAt) : undefined,
    };
    try {
      await run(() => request(editing ? `/admin/blog/${initial._id}` : "/admin/blog", { method: editing ? "PATCH" : "POST", body: payload }),
        payload.status === "published" ? "Published" : payload.status === "scheduled" ? "Scheduled" : "Draft saved");
      onSaved();
    } catch (e) { setErrors(e.details || {}); }
  }

  return (
    <Modal open onClose={onClose} wide title={editing ? "Edit post" : "New post"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{f.when === "now" ? "Publish" : f.when === "schedule" ? "Schedule" : "Save draft"}</Button></>}>
      <div className="space-y-5">
        {ai.open ? (
          <Card className="border-violet-400/25 bg-violet-400/5">
            <p className="mb-3 flex items-center gap-2 font-extrabold text-white"><Wand2 className="h-4 w-4 text-violet-300" />Draft with Claude</p>
            <div className="grid gap-3">
              <Input id="ai-topic" label="What's the post about?" placeholder="e.g. How to keep your home free of harmattan dust" value={ai.topic} onChange={(e) => setAi({ ...ai, topic: e.target.value })} />
              <TextArea id="ai-ins" label="Anything else? (optional)" rows={2} placeholder="e.g. Mention our deep cleaning service and Lekki/Ajah" value={ai.instructions} onChange={(e) => setAi({ ...ai, instructions: e.target.value })} />
              <div className="flex gap-2"><Button icon={Wand2} loading={busy} disabled={!ai.topic.trim()} onClick={draft}>Write the draft</Button><Button variant="ghost" onClick={() => setAi({ ...ai, open: false })}>Write it myself</Button></div>
            </div>
          </Card>
        ) : aiReady && <Button size="sm" variant="secondary" icon={Wand2} onClick={() => setAi({ ...ai, open: true })}>Draft with Claude</Button>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="bp-title" label="Title *" className="sm:col-span-2" error={errors.title} value={f.title} onChange={(e) => set("title", e.target.value)} />
          <Input id="bp-slug" label="Web address" hint={`cleaniq.ng/blog/${f.slug || "made-from-the-title"}`} value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
          <Input id="bp-tags" label="Tags" placeholder="harmattan, tips, Lagos" value={f.tags} onChange={(e) => set("tags", e.target.value)} />
          <TextArea id="bp-excerpt" label="Short summary" className="sm:col-span-2" rows={2} hint="Shown on the blog list and Google" value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
          <div className="sm:col-span-2">
            <Input id="bp-cover" label="Cover image link" placeholder="https://…" error={errors.coverImage} value={f.coverImage} onChange={(e) => set("coverImage", e.target.value)} />
            {/^https:\/\//.test(f.coverImage) ? <img src={f.coverImage} alt="Cover preview" className="mt-2 h-36 w-full rounded-xl object-cover" /> : <p className="mt-1 flex items-center gap-1 text-xs text-white/40"><ImageIcon className="h-3 w-3" />Paste an https:// link to a photo</p>}
          </div>
        </div>

        <div ref={body}>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wide text-white/60 uppercase">Post</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" icon={Heading2} onClick={() => insert("\n\n## ", "\n\n", "Heading")}>Heading</Button>
              <Button size="sm" variant="ghost" icon={List} onClick={() => insert("\n- ", "", "Point")}>List</Button>
              <Button size="sm" variant="ghost" icon={Link2} onClick={() => setLink({ text: "", url: "https://" })}>Link</Button>
            </div>
          </div>
          <TextArea id="bp-body" aria-label="Post text" rows={14} className="font-mono" value={f.body} onChange={(e) => set("body", e.target.value)}
            hint="Blank line = new paragraph · ## = heading · - = bullet point · [words](https://link) = link" />
        </div>

        <details className="rounded-2xl bg-white/[0.04] p-4">
          <summary className="cursor-pointer text-sm font-bold text-white">Google (optional)</summary>
          <div className="mt-3 grid gap-3">
            <Input id="bp-seo-t" label="Google title" hint={`${f.seo.title.length}/70`} value={f.seo.title} onChange={(e) => set("seo", { ...f.seo, title: e.target.value })} />
            <TextArea id="bp-seo-d" label="Google description" rows={2} hint={`${f.seo.description.length}/160`} value={f.seo.description} onChange={(e) => set("seo", { ...f.seo, description: e.target.value })} />
          </div>
        </details>

        <div className="rounded-2xl border border-white/8 p-4">
          <p className="mb-3 text-xs font-bold tracking-wide text-white/60 uppercase">When</p>
          <div className="flex flex-wrap gap-2">
            {[["draft", "Keep as draft"], ["now", "Publish now"], ["schedule", "Schedule"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => set("when", k)} className={`rounded-xl px-3 py-2 text-sm font-bold ${f.when === k ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>{l}</button>
            ))}
          </div>
          {f.when === "schedule" && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {[[1, "Tomorrow"], [2, "In 2 days"], [3, "In 3 days"], [4, "In 4 days"], [7, "In 1 week"]].map(([d, l]) => (
                  <Button key={d} size="sm" variant={f.publishAt === at9(d) ? "secondary" : "ghost"} onClick={() => set("publishAt", at9(d))}>{l}</Button>
                ))}
              </div>
              <Input id="bp-at" type="datetime-local" label="Goes live (Lagos time)" error={errors.publishAt} value={f.publishAt} onChange={(e) => set("publishAt", e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(link)} onClose={() => setLink(null)} title="Insert a link"
        footer={<><Button variant="ghost" onClick={() => setLink(null)}>Cancel</Button><Button disabled={!/^https?:\/\/\S+\.\S+/.test(link?.url || "")} onClick={() => { insert("[", `](${link.url})`, link.text || "link"); setLink(null); }}>Insert</Button></>}>
        {link && (
          <div className="grid gap-3">
            <Input id="ln-text" label="Words to show" placeholder="Book a deep clean" value={link.text} onChange={(e) => setLink({ ...link, text: e.target.value })} />
            <Input id="ln-url" label="Link" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
          </div>
        )}
      </Modal>
    </Modal>
  );
}

function Autopilot({ initial, aiReady, onClose, onSaved }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const [f, setF] = useState(initial);
  return (
    <Modal open onClose={onClose} title="Blog autopilot"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={() => run(() => request("/admin/blog/autopilot", { method: "PUT", body: f }), "Autopilot saved").then(onSaved).catch(() => {})}>Save</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-white/65">Claude writes a new post by itself every few days, following your instructions, and never repeats a recent topic.</p>
        {!aiReady && <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">Claude isn't connected yet — add ANTHROPIC_API_KEY to server/.env on the VPS.</p>}
        <Toggle id="ap-on" label="Autopilot on" checked={Boolean(f.enabled)} onChange={(v) => setF({ ...f, enabled: v })} />
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-white/60 uppercase">How often</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 7, 14].map((d) => (
              <button key={d} type="button" onClick={() => setF({ ...f, everyDays: d })} className={`rounded-xl px-3 py-2 text-sm font-bold ${f.everyDays === d ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>
                {d === 1 ? "Every day" : d === 7 ? "Weekly" : d === 14 ? "Fortnightly" : `Every ${d} days`}
              </button>
            ))}
          </div>
        </div>
        <TextArea id="ap-ins" label="Instructions for Claude" rows={5} placeholder="e.g. Write for busy Lagos families and landlords. Topics: deep cleaning, move-in/move-out, post-construction, office cleaning. Friendly, practical, Nigerian English."
          value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
        <Select id="ap-pub" label="New posts" value={f.publish ? "1" : "0"} onChange={(e) => setF({ ...f, publish: e.target.value === "1" })}
          options={[{ value: "0", label: "Save as a draft for me to check (recommended)" }, { value: "1", label: "Publish straight away" }]} />
        {f.lastRunAt && <p className="text-xs text-white/40">Last post written {dateTime(f.lastRunAt)}</p>}
      </div>
    </Modal>
  );
}
