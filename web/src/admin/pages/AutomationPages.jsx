// Admin → Automations, SMS automation and AI receptionist (settings + what it knows).
import { useState } from "react";
import { Bell, Bot, CalendarClock, CheckCircle2, FileText, MessageSquare, Phone, Receipt, Repeat, Save, Send, Smartphone, XCircle } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, ErrorBox, Input, Loading, PageHeader, StatCard, TextArea, Toggle, useAction, useToast } from "../ui";
import CollectionPage from "./CollectionPage";

const AUTOMATIONS = [
  { key: "dayBeforeReminder", icon: Bell, title: "Day-before reminder", text: "Emails the customer the day before their clean with the time and address." },
  { key: "payAfterInvoice", icon: Receipt, title: "Pay-after invoice", text: "When a pay-after clean is marked completed, the invoice is emailed with a Paystack link — due the next day." },
  { key: "weeklyBilling", icon: CalendarClock, title: "Weekly bill", text: "Every week, weekly customers get one invoice for last week's completed cleans." },
  { key: "subscriptionBilling", icon: Repeat, title: "Monthly plan billing", text: "On each plan's billing date, the customer is invoiced for the coming month." },
  { key: "overdueReminders", icon: Bell, title: "Overdue reminders", text: "Unpaid invoices get a reminder the day after they're due, and again 3 days later." },
  { key: "blogPublishing", icon: FileText, title: "Blog publishing", text: "Scheduled posts go live on time, and the blog autopilot writes new posts." },
];

function Saver({ onSave, busy, dirty }) {
  return <Button icon={Save} loading={busy} disabled={!dirty} onClick={onSave}>Save changes</Button>;
}

export function Automations() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad("/admin/automations");
  const [f, setF] = useState(null);
  const v = f || data?.automations;
  const edit = can("owner", "manager");
  const on = v ? AUTOMATIONS.filter((a) => v[a.key]).length : 0;
  return (
    <>
      <PageHeader title="Automations" subtitle="Things Cleaniq does for you automatically. Switch any of them off if you'd rather do it by hand."
        actions={edit && <Saver busy={busy} dirty={Boolean(f)} onSave={() => run(() => request("/admin/automations", { method: "PUT", body: f }), "Automations saved").then(() => { setF(null); reload(); }).catch(() => {})} />} />
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Switched on" value={`${on} of ${AUTOMATIONS.length}`} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Switched off" value={AUTOMATIONS.length - on} icon={XCircle} tone="rose" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {AUTOMATIONS.map((a) => (
              <Card key={a.key} className={`flex gap-4 ${v[a.key] ? "" : "opacity-70"}`}>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${v[a.key] ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-white/40"}`}><a.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-extrabold text-white">{a.title}</h2>
                    {edit ? <Toggle id={`au-${a.key}`} label={<span className="sr-only">{a.title}</span>} checked={Boolean(v[a.key])} onChange={(x) => setF({ ...v, [a.key]: x })} /> : <Badge tone={v[a.key] ? "Paid" : "Expired"}>{v[a.key] ? "On" : "Off"}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-white/60">{a.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const VARS = { reminder: ["{firstName}", "{date}", "{time}", "{ref}"], invoice: ["{firstName}", "{ref}", "{amount}", "{date}", "{link}"] };

export function SmsAutomation() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad("/admin/automations/sms");
  const [f, setF] = useState(null);
  const [test, setTest] = useState({ phone: "", template: "reminder" });
  const v = f || data?.sms;
  const edit = can("owner", "manager");
  const setT = (k, x) => setF({ ...v, templates: { ...v.templates, [k]: x } });
  const segments = (s) => Math.max(1, Math.ceil(String(s).length / 160));
  return (
    <>
      <PageHeader title="SMS automation" subtitle="Text messages to customers through Termii — reminders and invoices."
        actions={edit && <Saver busy={busy} dirty={Boolean(f)} onSave={() => run(() => request("/admin/automations/sms", { method: "PUT", body: f }), "SMS settings saved").then(() => { setF(null); reload(); }).catch(() => {})} />} />
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <div className="space-y-5">
          <Card className={`flex flex-col gap-3 sm:flex-row sm:items-center ${data.connected ? "border-emerald-400/25" : "border-amber-400/25"}`}>
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${data.connected ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}><Smartphone className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-extrabold text-white">{data.connected ? "Termii is connected" : "Termii isn't connected yet"}</p>
              <p className="text-sm text-white/60">{data.connected ? "Messages are sent from the sender name “Cleaniq”." : "Add TERMII_API_KEY to server/.env on the VPS, then restart the API. Until then nothing is sent."}</p>
            </div>
            {edit && <Toggle id="sms-on" label="Send texts" checked={Boolean(v.enabled)} onChange={(x) => setF({ ...v, enabled: x })} />}
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            {[["reminder", "dayBeforeReminder", "Day-before reminder", Bell], ["invoice", "invoiceIssued", "Invoice / payment link", Receipt]].map(([k, flag, title, Icon]) => (
              <Card key={k}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-extrabold text-white"><Icon className="h-4 w-4 text-emerald-300" />{title}</h2>
                  {edit && <Toggle id={`sms-${flag}`} label={<span className="sr-only">{title}</span>} checked={Boolean(v[flag])} onChange={(x) => setF({ ...v, [flag]: x })} />}
                </div>
                <TextArea id={`sms-${k}`} aria-label={`${title} message`} rows={4} value={v.templates[k]} disabled={!edit} onChange={(e) => setT(k, e.target.value)} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                  <span className="flex flex-wrap gap-1">{VARS[k].map((x) => <button key={x} type="button" disabled={!edit} onClick={() => setT(k, `${v.templates[k]} ${x}`)} className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-white/70 hover:bg-white/15">{x}</button>)}</span>
                  <span>{v.templates[k].length} characters · {segments(v.templates[k])} SMS</span>
                </div>
              </Card>
            ))}
          </div>
          {edit && (
            <Card>
              <h2 className="mb-3 font-extrabold text-white">Send a test</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input id="sms-test" label="Your phone" placeholder="0803 123 4567" className="flex-1" value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} />
                <div className="flex gap-2">
                  {["reminder", "invoice"].map((t) => <Button key={t} variant={test.template === t ? "secondary" : "ghost"} onClick={() => setTest({ ...test, template: t })}>{t === "reminder" ? "Reminder" : "Invoice"}</Button>)}
                </div>
                <Button icon={Send} loading={busy} disabled={!test.phone} onClick={() => run(() => request("/admin/automations/sms/test", { method: "POST", body: test })).then((r) => toast(r.result === "sent" ? "Test text sent" : `Not sent (${r.result}) — check Termii is connected`, r.result === "sent" ? undefined : "error")).catch(() => {})}>Send test</Button>
              </div>
              <p className="mt-2 text-xs text-white/40">Uses the saved message — save your changes first.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

export function AiReceptionist() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad("/admin/automations/ai");
  const [f, setF] = useState(null);
  const edit = can("owner", "manager");
  const base = data && { ...data.ai, names: data.ai.names.join(", ") };
  const v = f || base;
  const set = (k, x) => setF({ ...v, [k]: x });
  const save = () => run(() => request("/admin/automations/ai", { method: "PUT", body: { ...v, names: String(v.names).split(",") } }), "AI receptionist saved").then(() => { setF(null); reload(); }).catch(() => {});
  return (
    <>
      <PageHeader title="AI receptionist" subtitle="Answers WhatsApp messages and calls, gives prices from your price list and saves every enquiry as a lead."
        actions={edit && <Saver busy={busy} dirty={Boolean(f)} onSave={save} />} />
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {[["Claude (the AI)", data.ready.claude, Bot, "Add ANTHROPIC_API_KEY to server/.env"], ["WhatsApp", data.ready.whatsapp, MessageSquare, "Connect a WhatsApp Business number — next step"], ["Phone calls", data.ready.phone, Phone, "Connect a Nigerian phone number — next step"]].map(([name, ok, Icon, hint]) => (
              <Card key={name} className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${ok ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-white/40"}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0"><p className="font-bold text-white">{name}</p><p className="truncate text-xs text-white/50">{ok ? "Connected" : hint}</p></div>
                <Badge tone={ok ? "Paid" : "Expired"}>{ok ? "Ready" : "Not yet"}</Badge>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Answers it knows" value={data.stats.knowledge} icon={Bot} tone="emerald" />
            <StatCard label="Leads from calls & WhatsApp" value={data.stats.leads} icon={Phone} tone="sky" />
            <StatCard label="Conversations" value={data.stats.chats} icon={MessageSquare} tone="amber" />
          </div>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-extrabold text-white">How it answers</h2>
              {edit && <Toggle id="ai-on" label="Receptionist switched on" checked={Boolean(v.enabled)} onChange={(x) => set("enabled", x)} />}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input id="ai-names" label="Names it uses (it rotates them)" hint="Separate with commas. It never pretends to be a person if asked." disabled={!edit} value={v.names} onChange={(e) => set("names", e.target.value)} />
              <Input id="ai-phone" label="Hand over to (team phone)" placeholder="0803 123 4567" hint="When someone asks for a person, or it can't help" disabled={!edit} value={v.handoverPhone} onChange={(e) => set("handoverPhone", e.target.value)} />
              <TextArea id="ai-greet" label="Greeting" className="md:col-span-2" rows={2} disabled={!edit} value={v.greeting} onChange={(e) => set("greeting", e.target.value)} />
              <TextArea id="ai-instr" label="Extra instructions" className="md:col-span-2" rows={5} disabled={!edit} placeholder="e.g. Always ask which area of Lagos they're in. We don't clean on Sundays. Offer the monthly plan to anyone wanting weekly cleans."
                value={v.instructions} onChange={(e) => set("instructions", e.target.value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <Toggle id="ai-wa" label="Answer WhatsApp" checked={Boolean(v.channels?.whatsapp)} onChange={(x) => edit && set("channels", { ...v.channels, whatsapp: x })} />
              <Toggle id="ai-ph" label="Answer phone calls" checked={Boolean(v.channels?.phone)} onChange={(x) => edit && set("channels", { ...v.channels, phone: x })} />
              <Toggle id="ai-leads" label="Save every enquiry as a lead" checked={Boolean(v.saveLeads)} onChange={(x) => edit && set("saveLeads", x)} />
            </div>
          </Card>
          <CollectionPage type="knowledge" embedded title="What it knows" subtitle="Questions customers ask and the answers it should give. Prices come from your price list automatically." icon={Bot} />
        </div>
      )}
    </>
  );
}
