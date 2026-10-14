// Admin → Chat support: messages from the website chat/contact form (and calls/WhatsApp you log), answered by email.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Inbox, Mail, MessageSquarePlus, Phone, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, ConfirmModal, Empty, ErrorBox, Input, Loading, Modal, PageHeader, SearchBox, Select, TextArea, Toggle, dateTime, useAction } from "../ui";

const STATUS = { open: { label: "Needs a reply", tone: "Pending" }, waiting: { label: "Replied", tone: "Confirmed" }, closed: { label: "Closed", tone: "Expired" } };
const CHANNEL = { website: "Website", whatsapp: "WhatsApp", phone: "Phone call", email: "Email", instagram: "Instagram" };
const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export default function ChatSupport() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [ref, setRef] = useState(null);
  const [adding, setAdding] = useState(false);
  const list = useLoad(`/admin/support?limit=50${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState({ text: "", email: true, close: false });
  const [del, setDel] = useState(false);
  const end = useRef(null);
  const c = list.data?.counts || {};

  useEffect(() => {
    if (!ref) {
      setThread(null);
      return;
    }
    request(`/admin/support/${ref}`).then((r) => { setThread(r.thread); list.reload(); }).catch(() => setThread(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages?.length]);

  const update = (r) => { setThread(r.thread); list.reload(); };
  async function send() {
    const r = await run(() => request(`/admin/support/${ref}/reply`, { method: "POST", body: reply })).catch(() => null);
    if (!r) return;
    setReply({ text: "", email: true, close: false });
    update(r);
  }

  return (
    <>
      <PageHeader title="Chat support" subtitle="Messages from the website, and calls or WhatsApp chats you log. Replies are emailed to the customer."
        actions={<Button icon={Plus} onClick={() => setAdding(true)}>Log a conversation</Button>} />
      <div className="grid h-[calc(100vh-14rem)] min-h-[520px] overflow-hidden rounded-2xl border border-white/8 bg-adm-card lg:grid-cols-[360px_1fr]">
        {/* Inbox */}
        <aside className={`flex min-h-0 flex-col border-white/8 lg:border-r ${ref ? "hidden lg:flex" : "flex"}`}>
          <div className="space-y-3 border-b border-white/8 p-3">
            <div className="flex gap-1 rounded-xl bg-white/5 p-1">
              {[["open", `To reply${c.open ? ` · ${c.open}` : ""}`], ["waiting", "Replied"], ["closed", "Closed"], ["", "All"]].map(([k, l]) => (
                <button key={k || "all"} type="button" onClick={() => setStatus(k)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${status === k ? "bg-emerald-400 text-adm-bg" : "text-white/65 hover:text-white"}`}>{l}</button>
              ))}
            </div>
            <SearchBox value={q} onChange={setQ} placeholder="Search messages…" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.error ? <div className="p-3"><ErrorBox error={list.error} onRetry={list.reload} /></div> : list.loading && !list.data ? <Loading /> : !list.data.items.length ? (
              <div className="p-6"><Empty title={status === "open" ? "All caught up" : "Nothing here"} text={status === "open" ? "No one is waiting for a reply." : undefined} /></div>
            ) : list.data.items.map((t) => (
              <button key={t.ref} type="button" onClick={() => setRef(t.ref)}
                className={`flex w-full gap-3 border-b border-white/5 p-3 text-left transition hover:bg-white/[0.04] ${ref === t.ref ? "bg-emerald-400/[0.07]" : ""}`}>
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/8 text-sm font-black text-white/80">
                  {(t.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  {t.unread && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-adm-card bg-emerald-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2"><span className={`truncate ${t.unread ? "font-extrabold text-white" : "font-bold text-white/85"}`}>{t.name}</span><span className="shrink-0 text-[11px] text-white/40">{ago(t.lastMessageAt)}</span></span>
                  <span className="block truncate text-xs text-white/50">{t.messages?.[0]?.from === "admin" ? "You: " : ""}{t.messages?.[0]?.text}</span>
                  <span className="mt-1 block text-[11px] text-white/35">{CHANNEL[t.channel] || t.channel}{t.assignedTo ? ` · ${t.assignedTo}` : ""}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <section className={`min-h-0 flex-col ${ref ? "flex" : "hidden lg:flex"}`}>
          {!thread ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-white/40"><div><Inbox className="mx-auto mb-3 h-10 w-10" /><p>Choose a conversation</p></div></div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-white/8 p-3">
                <Button variant="ghost" size="sm" icon={ArrowLeft} className="lg:hidden" aria-label="Back" onClick={() => setRef(null)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-white">{thread.name} <span className="text-xs font-normal text-white/40">{thread.ref}</span></p>
                  <p className="truncate text-xs text-white/50">{[thread.email, thread.phone, CHANNEL[thread.channel]].filter(Boolean).join(" · ")}</p>
                </div>
                <Badge tone={STATUS[thread.status].tone}>{STATUS[thread.status].label}</Badge>
                {thread.phone && <a href={`https://wa.me/${thread.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-xl bg-white/8 p-2 text-white/80 hover:bg-white/15" aria-label="WhatsApp"><Phone className="h-4 w-4" /></a>}
                {thread.status !== "closed"
                  ? <Button size="sm" variant="secondary" icon={CheckCircle2} loading={busy} onClick={() => run(() => request(`/admin/support/${ref}`, { method: "PATCH", body: { status: "closed" } }), "Closed").then(update).catch(() => {})}>Close</Button>
                  : <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy} onClick={() => run(() => request(`/admin/support/${ref}`, { method: "PATCH", body: { status: "open" } }), "Reopened").then(update).catch(() => {})}>Reopen</Button>}
                {can("owner", "manager") && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete" onClick={() => setDel(true)} />}
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {thread.subject && <p className="text-center text-xs font-bold text-white/35">{thread.subject}</p>}
                {thread.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "admin" ? "rounded-br-md bg-emerald-400 text-adm-bg" : "rounded-bl-md bg-white/8 text-white/90"}`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <p className={`mt-1 text-[11px] ${m.from === "admin" ? "text-adm-bg/60" : "text-white/40"}`}>{m.from === "admin" ? `${m.by} · ` : ""}{dateTime(m.at)}</p>
                    </div>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <div className="border-t border-white/8 p-3">
                <TextArea id="cs-reply" aria-label="Reply" rows={3} placeholder={thread.email ? `Reply to ${thread.name.split(" ")[0]}…` : "Write a note of what you told them…"} value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value })} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-4">
                    {thread.email && <Toggle id="cs-email" label={<span className="flex items-center gap-1 text-xs"><Mail className="h-3.5 w-3.5" />Email it</span>} checked={reply.email} onChange={(v) => setReply({ ...reply, email: v })} />}
                    <Toggle id="cs-close" label={<span className="text-xs">Close after sending</span>} checked={reply.close} onChange={(v) => setReply({ ...reply, close: v })} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" icon={MessageSquarePlus} disabled={!reply.text.trim()} loading={busy} title="Add what the customer said (e.g. from a call)"
                      onClick={() => run(() => request(`/admin/support/${ref}/note`, { method: "POST", body: { text: reply.text } })).then((r) => { setReply({ ...reply, text: "" }); update(r); }).catch(() => {})}>Add their message</Button>
                    <Button size="sm" icon={Send} disabled={!reply.text.trim()} loading={busy} onClick={send}>Send reply</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <LogConversation open={adding} onClose={() => setAdding(false)} onDone={(t) => { setAdding(false); setStatus(""); list.reload(); setRef(t.ref); }} />
      <ConfirmModal open={del} onClose={() => setDel(false)} danger loading={busy} title="Delete this conversation?" text="It moves to the Bin and can be restored from there." confirmLabel="Delete"
        onConfirm={() => run(() => request(`/admin/support/${ref}`, { method: "DELETE" }), "Conversation deleted").then(() => { setDel(false); setRef(null); list.reload(); }).catch(() => {})} />
    </>
  );
}

function LogConversation({ open, onClose, onDone }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const empty = { name: "", phone: "", email: "", channel: "whatsapp", subject: "", message: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setErrors({});
    try {
      const r = await run(() => request("/admin/support", { method: "POST", body: f }), "Conversation logged");
      setF(empty);
      onDone(r.thread);
    } catch (e) { setErrors(e.details || {}); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Log a conversation" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="lc-name" label="Customer name *" error={errors.name} value={f.name} onChange={(e) => set("name", e.target.value)} />
        <Select id="lc-ch" label="How they got in touch" value={f.channel} onChange={(e) => set("channel", e.target.value)} options={Object.entries(CHANNEL).map(([value, label]) => ({ value, label }))} />
        <Input id="lc-phone" label="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <Input id="lc-email" label="Email (to reply by email)" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        <Input id="lc-sub" label="About" className="sm:col-span-2" placeholder="e.g. Price for a 3-bed flat in Yaba" value={f.subject} onChange={(e) => set("subject", e.target.value)} />
        <TextArea id="lc-msg" label="What they said *" className="sm:col-span-2" error={errors.message} value={f.message} onChange={(e) => set("message", e.target.value)} />
      </div>
    </Modal>
  );
}
