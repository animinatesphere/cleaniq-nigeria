// Admin → Settings (like the UK page): business details, VAT & supplies fee, payday, what's connected,
// and admin users & roles (owner only). API keys live in server/.env — only "connected / not set" shows here.
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Plus, Save, XCircle } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, DataTable, ErrorBox, Input, Loading, Modal, PageHeader, Select, Toggle, dateTime, useAction } from "../ui";

function Section({ title, text, children }) {
  return (
    <Card>
      <h2 className="font-extrabold text-white">{title}</h2>
      {text && <p className="mt-1 mb-4 text-sm text-white/55">{text}</p>}
      {!text && <div className="mb-4" />}
      {children}
    </Card>
  );
}

function Admins() {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad("/admin/settings/admins");
  const [add, setAdd] = useState(null);
  const [errors, setErrors] = useState({});

  const create = async () => {
    try {
      await run(() => request("/admin/settings/admins", { method: "POST", body: add }), `Invite emailed to ${add.email}`);
      setAdd(null);
      reload();
    } catch (e) { setErrors(e.details || {}); }
  };
  const patch = async (a, body, msg) => { await run(() => request(`/admin/settings/admins/${a._id}`, { method: "PATCH", body }), msg); reload(); };
  const reset = async (a) => run(() => request(`/admin/settings/admins/${a._id}/reset-password`, { method: "POST" }), `New temporary password emailed to ${a.email}`);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  const roles = [{ value: "owner", label: "Owner" }, { value: "manager", label: "Manager" }, { value: "staff", label: "Staff" }];
  return (
    <>
      <div className="mb-3 flex justify-end"><Button icon={Plus} onClick={() => { setErrors({}); setAdd({ name: "", email: "", role: "staff" }); }}>Add admin user</Button></div>
      <DataTable rows={data.items} columns={[
        { key: "n", label: "Name", render: (a) => <span className="font-bold text-white">{a.name}</span> },
        { key: "e", label: "Email", render: (a) => a.email },
        { key: "r", label: "Role", render: (a) => (
          <div onClick={(e) => e.stopPropagation()}><Select id={`role-${a._id}`} aria-label="Role" options={roles} value={a.role} onChange={(e) => patch(a, { role: e.target.value }, "Role changed")} /></div>
        ) },
        { key: "l", label: "Last login", render: (a) => (a.lastLoginAt ? dateTime(a.lastLoginAt) : a.mustChangePassword ? "Invited" : "—") },
        { key: "s", label: "Status", render: (a) => <Badge tone={a.active ? "Completed" : "Cancelled"}>{a.active ? "Active" : "Disabled"}</Badge> },
        { key: "x", label: "", className: "text-right", render: (a) => (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={KeyRound} loading={busy} onClick={() => reset(a)}>Reset password</Button>
            <Button size="sm" variant="secondary" onClick={() => patch(a, { active: !a.active }, a.active ? "Disabled" : "Enabled")}>{a.active ? "Disable" : "Enable"}</Button>
          </div>
        ) },
      ]} />
      <Modal open={Boolean(add)} onClose={() => setAdd(null)} title="Add admin user"
        footer={<Button loading={busy} onClick={create}>Send invite</Button>}>
        {add && (
          <div className="space-y-4">
            <Input id="ad-name" label="Name" value={add.name} onChange={(e) => setAdd((a) => ({ ...a, name: e.target.value }))} error={errors.name} />
            <Input id="ad-email" type="email" label="Email" value={add.email} onChange={(e) => setAdd((a) => ({ ...a, email: e.target.value }))} error={errors.email} />
            <Select id="ad-role" label="Role" options={roles} value={add.role} onChange={(e) => setAdd((a) => ({ ...a, role: e.target.value }))} error={errors.role} />
            <p className="text-xs text-white/50">They get an email with a temporary password and must change it when they first log in. Owners manage money and admin users; managers run bookings, staff and prices; staff handle day-to-day bookings.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Settings() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad("/admin/settings");
  const [biz, setBiz] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [payday, setPayday] = useState(28);
  const [errors, setErrors] = useState({});
  const canEdit = can("owner", "manager");

  useEffect(() => {
    if (!data) return;
    setBiz(data.business);
    setPricing({ suppliesFee: data.suppliesFee, vat: { ...data.vat } });
    setPayday(data.payroll?.payday || 28);
  }, [data]);

  const save = async (path, body, msg) => {
    setErrors({});
    try { await run(() => request(`/admin/settings/${path}`, { method: "PUT", body }), msg); reload(); } catch (e) { setErrors(e.details || {}); }
  };

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !biz || !pricing) return <Loading />;
  const integ = data.integrations;
  const setB = (k) => (e) => setBiz((b) => ({ ...b, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Settings" subtitle="Business details, prices, payday, connections and admin users." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Business details" text="Shown on emails, quotes and invoices.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="b-name" label="Business name" value={biz.name} onChange={setB("name")} disabled={!canEdit} />
            <Input id="b-email" type="email" label="Email" value={biz.email} onChange={setB("email")} error={errors.email} disabled={!canEdit} />
            <Input id="b-phone" type="tel" label="Phone" value={biz.phone} onChange={setB("phone")} error={errors.phone} disabled={!canEdit} />
            <Input id="b-wa" type="tel" label="WhatsApp" value={biz.whatsapp} onChange={setB("whatsapp")} error={errors.whatsapp} disabled={!canEdit} />
            <Input id="b-addr" label="Address" value={biz.address} onChange={setB("address")} className="sm:col-span-2" disabled={!canEdit} />
            <Input id="b-sms" label="SMS sender name (max 11)" value={biz.smsSenderId} onChange={setB("smsSenderId")} disabled={!canEdit} />
          </div>
          {canEdit && <Button className="mt-4" icon={Save} loading={busy} onClick={() => save("business", biz, "Business details saved")}>Save</Button>}
        </Section>

        <Section title="Prices: VAT & supplies" text="VAT is added on top of prices when switched on. The supplies fee is added per clean when Cleaniq brings the supplies.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-end pb-2 sm:col-span-2"><Toggle id="vat-on" label="Charge VAT" checked={Boolean(pricing.vat.enabled)} onChange={(v) => setPricing((p) => ({ ...p, vat: { ...p.vat, enabled: v } }))} /></div>
            <Input id="vat-rate" type="number" min="0" max="100" step="0.1" label="VAT rate (%)" value={pricing.vat.rate} onChange={(e) => setPricing((p) => ({ ...p, vat: { ...p.vat, rate: e.target.value } }))} error={errors.vatRate} disabled={!canEdit} />
            <Input id="vat-label" label="Label" value={pricing.vat.label} onChange={(e) => setPricing((p) => ({ ...p, vat: { ...p.vat, label: e.target.value } }))} disabled={!canEdit} />
            <Input id="sup-fee" type="number" min="0" label="Supplies fee per clean (₦)" value={pricing.suppliesFee} onChange={(e) => setPricing((p) => ({ ...p, suppliesFee: e.target.value }))} error={errors.suppliesFee} disabled={!canEdit} />
          </div>
          {canEdit && <Button className="mt-4" icon={Save} loading={busy} onClick={() => save("pricing", { suppliesFee: Number(pricing.suppliesFee), vat: { ...pricing.vat, rate: Number(pricing.vat.rate) } }, "Prices saved")}>Save</Button>}
        </Section>

        <Section title="Payday" text="Cleaners are paid once a month on this day (Staff pay).">
          <div className="max-w-xs">
            <Select id="payday" label="Day of the month" value={payday} onChange={(e) => setPayday(Number(e.target.value))} disabled={!canEdit}
              options={Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `${i + 1}` }))} error={errors.payday} />
          </div>
          {canEdit && <Button className="mt-4" icon={Save} loading={busy} onClick={() => save("payroll", { payday }, "Payday saved")}>Save</Button>}
        </Section>

        <Section title="Connections" text="Keys are kept safely on the server (server/.env), never in the admin. Ask your developer to add any that show 'Not set'.">
          <ul className="space-y-2 text-sm">
            {[["Paystack payments & transfers", integ.paystack], ["Email sending", integ.email, integ.emailFrom], ["SMS (Termii)", integ.sms], ["AI (blog drafts, receptionist)", integ.ai], ["Team notification email", Boolean(integ.teamEmail), integ.teamEmail]].map(([label, on, extra]) => (
              <li key={label} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                <span className="text-white/80">{label}{extra ? <span className="text-white/40"> · {extra}</span> : null}</span>
                {on ? <span className="flex items-center gap-1.5 font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Connected</span> : <span className="flex items-center gap-1.5 font-bold text-amber-300"><XCircle className="h-4 w-4" /> Not set</span>}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {can("owner") && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-extrabold text-white">Admin users & roles</h2>
          <Admins />
        </div>
      )}
    </>
  );
}
