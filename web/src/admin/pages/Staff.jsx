// Cleaners: add (welcome email with login), edit details/areas/availability, bank details, suspend, reset password.
import { useEffect, useState } from "react";
import { Ban, Banknote, CheckCircle2, KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, ConfirmModal, DataTable, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SearchBox, Select, TextArea, dateTime, naira, useAction } from "../ui";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const blank = { firstName: "", lastName: "", email: "", phone: "", areas: [], availability: [], notes: "" };

export default function Staff() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useLoad(`/admin/workers?q=${encodeURIComponent(search)}&page=${page}`);
  const options = useLoad("/bookings/options");
  const banks = useLoad(can("owner", "manager") ? "/admin/workers/banks" : null);
  const [modal, setModal] = useState(null); // { mode: add|edit|bank|delete|reset, worker }
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const managers = can("owner", "manager");

  const open = (mode, w) => {
    setErrors({});
    setModal({ mode, worker: w });
    if (mode === "add") setForm(blank);
    if (mode === "edit") setForm({ ...blank, ...w, phone: w.phone || "" });
    if (mode === "bank") setForm({ bankCode: w.bank?.bankCode || "", accountNumber: "" });
  };
  const close = () => setModal(null);
  async function submit(fn, msg) {
    try {
      await run(fn, msg);
      close();
      reload();
    } catch (e) {
      setErrors(e.details || {});
    }
  }

  const columns = [
    { key: "name", label: "Name", render: (w) => <span className="font-bold text-white">{w.firstName} {w.lastName}</span> },
    { key: "phone", label: "Phone" },
    { key: "areas", label: "Areas", render: (w) => w.areas?.slice(0, 3).join(", ") + (w.areas?.length > 3 ? "…" : "") },
    { key: "jobs", label: "Jobs", render: (w) => `${w.completed} done · ${w.upcoming} upcoming` },
    { key: "unpaid", label: "Unpaid", render: (w) => naira(w.unpaid) },
    { key: "active", label: "Last active", render: (w) => dateTime(w.lastActiveAt || w.lastLoginAt) },
    { key: "status", label: "Status", render: (w) => <Badge>{w.status}</Badge> },
    {
      key: "actions", label: "",
      render: (w) => managers && (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => open("edit", w)}>Edit</Button>
          <Button size="sm" variant="secondary" icon={Banknote} onClick={() => open("bank", w)}>Bank</Button>
          <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => open("reset", w)} aria-label="Reset password" />
          <Button size="sm" variant="secondary" icon={w.status === "active" ? Ban : CheckCircle2} loading={busy}
            onClick={() => submit(() => request(`/admin/workers/${w._id}/status`, { method: "POST", body: { status: w.status === "active" ? "suspended" : "active" } }), w.status === "active" ? "Cleaner suspended" : "Cleaner reactivated")}
            aria-label={w.status === "active" ? "Suspend" : "Reactivate"} />
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => open("delete", w)} aria-label="Delete" />
        </div>
      ),
    },
  ];

  const toggleDay = (day) => {
    const has = form.availability.find((a) => a.day === day);
    setForm({ ...form, availability: has ? form.availability.filter((a) => a.day !== day) : [...form.availability, { day, from: "08:00", to: "17:00" }].sort((a, b) => a.day - b.day) });
  };
  const setTime = (day, k, v) => setForm({ ...form, availability: form.availability.map((a) => (a.day === day ? { ...a, [k]: v } : a)) });
  const body = () => ({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, areas: form.areas, availability: form.availability, notes: form.notes });

  return (
    <>
      <PageHeader title="Cleaners" subtitle={data ? `${data.total} cleaners` : " "} actions={managers && <Button icon={UserPlus} onClick={() => open("add")}>Add cleaner</Button>} />
      <div className="mb-5"><SearchBox value={q} onChange={setQ} placeholder="Name, email, phone" /></div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} empty={<Empty title="No cleaners yet" text="Add your first cleaner, or accept one from Applicants." />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}

      <Modal open={modal?.mode === "add" || modal?.mode === "edit"} onClose={close} wide title={modal?.mode === "add" ? "Add a cleaner" : "Edit cleaner"}
        footer={<><Button variant="ghost" onClick={close}>Cancel</Button>
          <Button loading={busy} onClick={() => submit(() => request(modal.mode === "add" ? "/admin/workers" : `/admin/workers/${modal.worker._id}`, { method: modal.mode === "add" ? "POST" : "PATCH", body: body() }), modal.mode === "add" ? "Cleaner added — welcome email sent" : "Saved")}>
            {modal?.mode === "add" ? "Add & send welcome email" : "Save"}
          </Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="w-first" label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} error={errors.firstName} />
          <Input id="w-last" label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} error={errors.lastName} />
          <Input id="w-email" type="email" label="Email (their login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <Input id="w-phone" label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
        </div>
        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">Areas they cover</legend>
          <div className="flex flex-wrap gap-1.5">
            {(options.data?.areas || []).map((a) => {
              const on = form.areas.includes(a);
              return (
                <button key={a} type="button" aria-pressed={on} onClick={() => setForm({ ...form, areas: on ? form.areas.filter((x) => x !== a) : [...form.areas, a] })}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-emerald-400 text-adm-bg" : "bg-white/8 text-white/70 hover:bg-white/15"}`}>
                  {a}
                </button>
              );
            })}
          </div>
          {errors.areas && <p className="mt-1 text-xs text-rose-300">{errors.areas}</p>}
        </fieldset>
        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">Availability</legend>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const slot = form.availability.find((a) => a.day === d);
              return (
                <div key={d} className="flex flex-wrap items-center gap-3">
                  <label className="flex w-20 items-center gap-2 text-sm font-semibold text-white">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={Boolean(slot)} onChange={() => toggleDay(d)} /> {DAY_NAMES[d]}
                  </label>
                  {slot && (
                    <>
                      <input aria-label={`${DAY_NAMES[d]} from`} type="time" value={slot.from} onChange={(e) => setTime(d, "from", e.target.value)} className="rounded-lg border border-white/10 bg-adm-bg px-2 py-1 text-sm text-white" />
                      <span className="text-white/40">to</span>
                      <input aria-label={`${DAY_NAMES[d]} to`} type="time" value={slot.to} onChange={(e) => setTime(d, "to", e.target.value)} className="rounded-lg border border-white/10 bg-adm-bg px-2 py-1 text-sm text-white" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {errors.availability && <p className="mt-1 text-xs text-rose-300">{errors.availability}</p>}
        </fieldset>
        <TextArea id="w-notes" label="Notes" className="mt-5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {modal?.mode === "add" && <p className="mt-3 text-xs text-white/50">They'll get an email with the app link, their login and a temporary password.</p>}
      </Modal>

      <Modal open={modal?.mode === "bank"} onClose={close} title={`Bank details — ${modal?.worker?.firstName || ""}`}
        footer={<><Button variant="ghost" onClick={close}>Cancel</Button>
          <Button loading={busy} onClick={() => submit(() => request(`/admin/workers/${modal.worker._id}/bank`, { method: "PATCH", body: { ...form, bankName: banks.data?.banks.find((b) => b.code === form.bankCode)?.name } }), "Bank details checked & saved")}>
            Check & save
          </Button></>}>
        {modal?.worker?.bank?.accountNumber && (
          <p className="mb-4 rounded-xl bg-white/5 p-3 text-sm text-white/70">Current: {modal.worker.bank.bankName} · {modal.worker.bank.accountNumber} · {modal.worker.bank.accountName}</p>
        )}
        <div className="space-y-4">
          <Select id="bank" label="Bank" placeholder={banks.loading ? "Loading banks…" : "Choose bank"} options={(banks.data?.banks || []).map((b) => ({ value: b.code, label: b.name }))} value={form.bankCode} onChange={(e) => setForm({ ...form, bankCode: e.target.value })} error={errors.bankCode || banks.error} />
          <Input id="acct" inputMode="numeric" label="Account number (10 digits)" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} error={errors.accountNumber} />
          <p className="text-xs text-white/50">We check the account with Paystack and save the real account name.</p>
        </div>
      </Modal>

      <ConfirmModal open={modal?.mode === "reset"} onClose={close} title="Reset password?" text={`${modal?.worker?.firstName} gets an email with a new temporary password.`} confirmLabel="Send new password" loading={busy}
        onConfirm={() => submit(() => request(`/admin/workers/${modal.worker._id}/reset-password`, { method: "POST" }), "New password emailed")} />
      <ConfirmModal open={modal?.mode === "delete"} onClose={close} danger title="Delete cleaner?" text="They move to the Bin and can be restored." confirmLabel="Delete" loading={busy}
        onConfirm={() => submit(() => request(`/admin/workers/${modal.worker._id}`, { method: "DELETE" }), "Moved to the Bin")} />
    </>
  );
}
