// Admin → Price list. Nigeria charges per clean: each main service has a table of prices by property type ×
// bedrooms (empty cell = priced by quote), plus extra-bathroom price. Fixed-price items and add-ons below.
// Estimated hours are only for scheduling cleaners — never part of the price.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Info, Pencil, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, ConfirmModal, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Select, Toggle, naira, useAction } from "../ui";

const TYPES = ["Flat", "Terrace", "Bungalow", "Duplex", "Mansion"];
const ROWS = [0, 1, 2, 3, 4, 5, 6];
const rowLabel = (n) => (n === 0 ? "Self-contain" : n === 6 ? "6+ bedrooms" : `${n} bedroom${n > 1 ? "s" : ""}`);
const PRICING_LABEL = { size: "Per clean · by property size", fixed: "Fixed price", quote: "Priced by quote" };
const key = (t, b) => `${t}:${b}`;

// Table state: { "Flat:2": { price: "20000", estHours: "3" } }
const toGrid = (cells = []) => Object.fromEntries(cells.map((c) => [key(c.propertyType, c.bedrooms), { price: String(c.price), estHours: c.estHours == null ? "" : String(c.estHours) }]));
const fromGrid = (grid) =>
  Object.entries(grid)
    .filter(([, v]) => String(v.price ?? "").trim() !== "")
    .map(([k, v]) => {
      const [propertyType, b] = k.split(":");
      return { propertyType, bedrooms: Number(b), price: Number(v.price), estHours: String(v.estHours ?? "").trim() === "" ? null : Number(v.estHours) };
    });

function Cell({ value, onChange, disabled, error, label }) {
  return (
    <div className={`rounded-xl border p-1.5 transition-colors ${error ? "border-rose-400/70" : value.price ? "border-emerald-400/25 bg-emerald-400/[0.04]" : "border-white/8 border-dashed"}`}>
      <div className="flex items-center gap-1">
        <span className="pl-1 text-xs text-white/40">₦</span>
        <input
          aria-label={`${label} price`}
          inputMode="numeric"
          placeholder="Quote"
          disabled={disabled}
          value={value.price}
          onChange={(e) => onChange({ ...value, price: e.target.value.replace(/[^\d.]/g, "") })}
          className="w-full min-w-0 bg-transparent py-1 text-sm font-bold text-white outline-none placeholder:font-normal placeholder:text-white/25 disabled:opacity-70"
        />
      </div>
      <div className="flex items-center gap-1 border-t border-white/5 pt-1">
        <Clock className="ml-1 h-3 w-3 shrink-0 text-white/30" />
        <input
          aria-label={`${label} estimated hours`}
          inputMode="decimal"
          placeholder="hrs"
          disabled={disabled}
          value={value.estHours}
          onChange={(e) => onChange({ ...value, estHours: e.target.value.replace(/[^\d.]/g, "") })}
          className="w-full min-w-0 bg-transparent text-xs text-white/60 outline-none placeholder:text-white/20 disabled:opacity-70"
        />
      </div>
    </div>
  );
}

function SizeTable({ service, canEdit, onSaved }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const initial = useMemo(() => ({ grid: toGrid(service.sizePrices), bath: String(service.extraBathroomPrice || 0) }), [service]);
  const [grid, setGrid] = useState(initial.grid);
  const [bath, setBath] = useState(initial.bath);
  const [errors, setErrors] = useState({});
  const [phoneType, setPhoneType] = useState("Flat");
  useEffect(() => {
    setGrid(initial.grid);
    setBath(initial.bath);
  }, [initial]);
  const dirty = JSON.stringify(grid) !== JSON.stringify(initial.grid) || bath !== initial.bath;
  const cell = (t, b) => grid[key(t, b)] || { price: "", estHours: "" };
  const setCell = (t, b) => (v) => setGrid((g) => ({ ...g, [key(t, b)]: v }));
  const offered = fromGrid(grid).length;

  async function save() {
    setErrors({});
    try {
      await run(() => request(`/admin/services/${service._id}`, { method: "PATCH", body: { sizePrices: fromGrid(grid), extraBathroomPrice: Number(bath || 0) } }), `${service.name} prices saved`);
      onSaved();
    } catch (e) {
      setErrors(e.details || {});
    }
  }

  return (
    <div className="mt-5">
      {/* Desktop/tablet: the whole table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-separate border-spacing-1.5 text-left">
          <thead>
            <tr>
              <th className="w-32 text-xs font-bold tracking-wider text-white/40 uppercase">Size</th>
              {TYPES.map((t) => (
                <th key={t} className="text-xs font-bold tracking-wider text-white/60 uppercase">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((b) => (
              <tr key={b}>
                <th className="pr-2 text-sm font-semibold text-white/80">{rowLabel(b)}</th>
                {TYPES.map((t) => (
                  <td key={t}>
                    <Cell value={cell(t, b)} onChange={setCell(t, b)} disabled={!canEdit} error={errors[`size.${key(t, b)}`]} label={`${rowLabel(b)} ${t}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phones: pick a property type, then its rows */}
      <div className="md:hidden">
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Property type">
          {TYPES.map((t) => (
            <button key={t} role="tab" aria-selected={phoneType === t} onClick={() => setPhoneType(t)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${phoneType === t ? "bg-emerald-400 text-adm-bg" : "bg-white/8 text-white/70"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {ROWS.map((b) => (
            <div key={b} className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <span className="text-sm font-semibold text-white/80">{rowLabel(b)}</span>
              <Cell value={cell(phoneType, b)} onChange={setCell(phoneType, b)} disabled={!canEdit} error={errors[`size.${key(phoneType, b)}`]} label={`${rowLabel(b)} ${phoneType}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-end sm:justify-between">
        <Input id={`bath-${service._id}`} label="Each extra bathroom (beyond one per bedroom)" inputMode="numeric" value={bath} disabled={!canEdit} onChange={(e) => setBath(e.target.value.replace(/[^\d.]/g, ""))} error={errors.extraBathroomPrice} className="sm:w-72" />
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">{offered} sizes priced · empty = quote</span>
          {canEdit && dirty && (
            <Button variant="ghost" icon={Undo2} onClick={() => { setGrid(initial.grid); setBath(initial.bath); setErrors({}); }}>
              Undo
            </Button>
          )}
          {canEdit && (
            <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>
              Save prices
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FixedEditor({ service, canEdit, onSaved }) {
  const { request } = useAuth();
  const [run, busy] = useAction();
  const [rate, setRate] = useState(String(service.rate || 0));
  const [unit, setUnit] = useState(service.unitLabel || "");
  const [options, setOptions] = useState(service.options || []);
  const [errors, setErrors] = useState({});
  async function save() {
    try {
      await run(() => request(`/admin/services/${service._id}`, { method: "PATCH", body: { rate: Number(rate || 0), unitLabel: unit, options: options.map((o) => ({ label: o.label, rate: Number(o.rate || 0) })) } }), `${service.name} saved`);
      onSaved();
    } catch (e) {
      setErrors(e.details || {});
    }
  }
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id={`rate-${service._id}`} label={options.length ? "Default price (₦)" : "Price (₦)"} inputMode="numeric" value={rate} disabled={!canEdit} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} error={errors.rate} />
        <Input id={`unit-${service._id}`} label="Priced per" placeholder="e.g. carpet, oven" value={unit} disabled={!canEdit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">Options (e.g. Single / Double oven)</p>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input id={`ol-${service._id}-${i}`} aria-label="Option name" value={o.label} disabled={!canEdit} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="flex-1" />
              <Input id={`or-${service._id}-${i}`} aria-label="Option price" inputMode="numeric" value={String(o.rate)} disabled={!canEdit} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, rate: e.target.value.replace(/[^\d.]/g, "") } : x)))} className="w-32" error={errors[`options.${i}`]} />
              {canEdit && <Button variant="ghost" icon={Trash2} aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))} />}
            </div>
          ))}
        </div>
        {canEdit && (
          <Button size="sm" variant="secondary" icon={Plus} className="mt-2" onClick={() => setOptions([...options, { label: "", rate: "" }])}>
            Add option
          </Button>
        )}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button icon={Save} loading={busy} onClick={save}>Save</Button>
        </div>
      )}
    </div>
  );
}

export default function PriceList() {
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const canEdit = can("owner", "manager");
  const { data, error, loading, reload } = useLoad("/admin/services");
  const settings = useLoad("/admin/settings");
  const [modal, setModal] = useState(null); // { mode: "add" | "edit" | "delete", service }
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const base = data.items.filter((s) => s.category === "Base");
  const extras = data.items.filter((s) => s.category === "Extras");

  const openEdit = (s) => {
    setErrors({});
    setForm({ name: s.name, description: s.description || "", pricing: s.pricing, active: s.active, sortOrder: s.sortOrder, rate: s.rate, unitLabel: s.unitLabel });
    setModal({ mode: "edit", service: s });
  };
  const openAdd = (category) => {
    setErrors({});
    setForm({ name: "", description: "", category, pricing: category === "Base" ? "size" : "fixed", rate: "", unitLabel: "", active: true });
    setModal({ mode: "add" });
  };
  async function submit() {
    try {
      if (modal.mode === "add") await run(() => request("/admin/services", { method: "POST", body: { ...form, rate: Number(form.rate || 0) } }), `${form.name} added`);
      else await run(() => request(`/admin/services/${modal.service._id}`, { method: "PATCH", body: form.category === "Extras" || modal.service.category === "Extras" ? { ...form, rate: Number(form.rate || 0) } : { name: form.name, description: form.description, pricing: form.pricing, active: form.active, sortOrder: form.sortOrder } }), "Saved");
      setModal(null);
      reload();
    } catch (e) {
      setErrors(e.details || {});
    }
  }
  const toggleActive = (s) => run(() => request(`/admin/services/${s._id}`, { method: "PATCH", body: { active: !s.active } }), s.active ? `${s.name} hidden from customers` : `${s.name} is live`).then(reload);

  return (
    <>
      <PageHeader
        title="Price list"
        subtitle="Prices are per clean, by property type and size — never per hour."
        actions={canEdit && <Button icon={Plus} onClick={() => openAdd("Base")}>Add service</Button>}
      />

      <Card className="mb-5 flex gap-3 border-emerald-400/20 bg-emerald-400/[0.05]">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        <div className="text-sm text-white/75">
          <p>
            Customers see the price for their property instantly. <strong className="text-white">Empty cells</strong> mean “we'll quote after a look”. The clock number is the{" "}
            <strong className="text-white">estimated cleaning time</strong> — used to plan cleaners' days, never added to the price.
          </p>
          {settings.data && (
            <p className="mt-2 text-white/55">
              Supplies fee {naira(settings.data.suppliesFee)} per visit · VAT {settings.data.vat.enabled ? `${settings.data.vat.rate}% on` : "off"} — change these in Settings.
            </p>
          )}
          {!canEdit && <p className="mt-2 font-semibold text-amber-200">You can view prices; only owners and managers can change them.</p>}
        </div>
      </Card>

      <div className="space-y-5">
        {base.map((s, i) => (
          <motion.div key={s._id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={s.active ? "" : "opacity-60"}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold text-white">{s.name}</h2>
                    <Badge tone={s.pricing === "size" ? "Paid" : s.pricing === "quote" ? "Pending" : "Sent"}>{PRICING_LABEL[s.pricing]}</Badge>
                    {!s.active && <Badge tone="Cancelled">Hidden</Badge>}
                  </div>
                  {s.description && <p className="mt-1 max-w-2xl text-sm text-white/55">{s.description}</p>}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Toggle id={`active-${s._id}`} label="Live" checked={s.active} onChange={() => toggleActive(s)} />
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEdit(s)}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${s.name}`} onClick={() => setModal({ mode: "delete", service: s })} />
                  </div>
                )}
              </div>
              {s.pricing === "size" && <SizeTable service={s} canEdit={canEdit} onSaved={reload} />}
              {s.pricing === "fixed" && <FixedEditor service={s} canEdit={canEdit} onSaved={reload} />}
              {s.pricing === "quote" && (
                <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/65">Customers request a quote; you set the price per job in the Quote builder.</p>
              )}
            </Card>
          </motion.div>
        ))}
        {!base.length && <Card><Empty title="No services yet" action={canEdit && <Button icon={Plus} onClick={() => openAdd("Base")}>Add service</Button>} /></Card>}

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-white">Add-ons</h2>
              <p className="text-sm text-white/55">Extras customers can add to any clean.</p>
            </div>
            {canEdit && <Button size="sm" icon={Plus} onClick={() => openAdd("Extras")}>Add add-on</Button>}
          </div>
          <ul className="divide-y divide-white/5">
            {extras.map((x) => (
              <li key={x._id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${x.active ? "" : "opacity-50"}`}>
                <div>
                  <p className="font-bold text-white">{x.name}</p>
                  <p className="text-sm text-white/55">
                    {naira(x.rate)}
                    {x.unitLabel ? ` per ${x.unitLabel}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Toggle id={`x-active-${x._id}`} label="Live" checked={x.active} onChange={() => toggleActive(x)} />
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { openEdit(x); setForm((f) => ({ ...f, category: "Extras" })); }}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${x.name}`} onClick={() => setModal({ mode: "delete", service: x })} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={modal?.mode === "add" || modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={modal?.mode === "add" ? (form.category === "Extras" ? "Add an add-on" : "Add a service") : `Edit ${modal?.service?.name || ""}`}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}
      >
        <div className="space-y-4">
          <Input id="s-name" label="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input id="s-desc" label="Short description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {(form.category === "Base" || modal?.service?.category === "Base") && (
            <Select
              id="s-pricing"
              label="How is it priced?"
              options={[{ value: "size", label: "Per clean, by property size (price table)" }, { value: "fixed", label: "Fixed price per item (with optional options)" }, { value: "quote", label: "Priced per job by quote" }]}
              value={form.pricing}
              onChange={(e) => setForm({ ...form, pricing: e.target.value })}
              error={errors.pricing}
            />
          )}
          {(form.category === "Extras" || modal?.service?.category === "Extras" || (modal?.mode === "add" && form.pricing === "fixed")) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="s-rate" label="Price (₦)" inputMode="numeric" value={form.rate ?? ""} onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/[^\d.]/g, "") })} error={errors.rate} />
              <Input id="s-unit" label="Priced per" placeholder="load, room, fridge…" value={form.unitLabel || ""} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
            </div>
          )}
          {modal?.mode === "add" && form.pricing === "size" && <p className="text-xs text-white/50">After saving, fill in its price table on this page.</p>}
        </div>
      </Modal>

      <ConfirmModal
        open={modal?.mode === "delete"}
        onClose={() => setModal(null)}
        danger
        title={`Delete ${modal?.service?.name || ""}?`}
        text="It moves to the Bin and can be restored. To stop selling it for now, switch off “Live” instead."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={async () => {
          await run(() => request(`/admin/services/${modal.service._id}`, { method: "DELETE" }), "Moved to the Bin");
          setModal(null);
          reload();
        }}
      />
    </>
  );
}
