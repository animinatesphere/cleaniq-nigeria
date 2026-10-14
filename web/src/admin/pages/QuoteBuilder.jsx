// Admin → Quote builder (like the UK QuoteBuilder): customer + property, lines from the price list
// (priced by property size, fixed options, or "price on request"), custom lines, add-ons, discount,
// live total from the server, then email the quote with an Accept button.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Send, Trash2 } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Button, Card, ErrorBox, Input, Loading, PageHeader, Select, TextArea, Toggle, naira, time12, useToast } from "../ui";

const TIMES = [];
for (let m = 8 * 60; m <= 18 * 60; m += 30) TIMES.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const today = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10);

const newLine = () => ({ id: Math.random().toString(36).slice(2), serviceSlug: "", label: "", propertyType: "", bedrooms: 1, bathrooms: 1, option: "", unitPrice: "", qty: 1, extras: {} });

const EMPTY = {
  firstName: "", lastName: "", email: "", phone: "", area: "", address: "", landmark: "",
  propertyType: "", bedrooms: 1, bathrooms: 1, kitchens: 1, livingRooms: 1, stairs: 0, pets: false,
  supplies: "customer", serviceDate: "", serviceTime: "", notes: "", discount: "", discountLabel: "Discount", send: true,
};

function LineEditor({ line, index, services, propertyTypes, errors, canOverride, onChange, onRemove }) {
  const svc = services.base.find((s) => s.slug === line.serviceSlug);
  const set = (k) => (e) => onChange({ ...line, [k]: e?.target ? e.target.value : e });
  const custom = line.serviceSlug === "__custom";
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-wide text-white/40 uppercase">Line {index + 1}</p>
        <button type="button" onClick={onRemove} aria-label="Remove line" className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-rose-500/15 hover:text-rose-300">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id={`svc-${line.id}`} label="Service" placeholder="Choose service"
          options={[...services.base.map((s) => ({ value: s.slug, label: s.fromPrice ? `${s.name} — from ${naira(s.fromPrice)}` : s.name })), { value: "__custom", label: "Custom line (type it)" }]}
          value={line.serviceSlug} onChange={set("serviceSlug")} error={errors[`items.${index}`]} />
        <Input id={`qty-${line.id}`} type="number" min="1" max="100" label="Number of cleans / items" value={line.qty} onChange={set("qty")} />
        {custom && (
          <>
            <Input id={`label-${line.id}`} label="Description" value={line.label} onChange={set("label")} placeholder="e.g. Post-construction clean, 4-bed duplex" />
            <Input id={`price-${line.id}`} type="number" min="0" label="Price each (₦)" value={line.unitPrice} onChange={set("unitPrice")} />
          </>
        )}
        {svc?.pricing === "size" && (
          <>
            <Select id={`pt-${line.id}`} label="Property type" placeholder="Choose" options={propertyTypes} value={line.propertyType} onChange={set("propertyType")} />
            <div className="grid grid-cols-2 gap-3">
              <Input id={`bd-${line.id}`} type="number" min="0" max="10" label="Bedrooms" value={line.bedrooms} onChange={set("bedrooms")} />
              <Input id={`ba-${line.id}`} type="number" min="0" max="10" label="Bathrooms" value={line.bathrooms} onChange={set("bathrooms")} />
            </div>
          </>
        )}
        {svc?.pricing === "fixed" && svc.options?.length > 0 && (
          <Select id={`opt-${line.id}`} label="Option" placeholder="Choose" options={svc.options.map((o) => ({ value: o.label, label: `${o.label} — ${naira(o.rate)}` }))} value={line.option} onChange={set("option")} />
        )}
        {svc && (svc.pricing === "quote" || canOverride) && (
          <Input id={`up-${line.id}`} type="number" min="0" label={svc.pricing === "quote" ? "Price each (₦)" : "Override price each (₦, optional)"} value={line.unitPrice} onChange={set("unitPrice")}
            hint={svc.pricing === "quote" ? "This service is priced per job." : "Leave empty to use the price list."} />
        )}
      </div>
      {svc && services.extras.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-white/40 uppercase">Add-ons</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {services.extras.map((x) => (
              <Input key={x.slug} id={`x-${line.id}-${x.slug}`} type="number" min="0" max="20" placeholder="0" label={`${x.name} · ${naira(x.rate)}`}
                value={line.extras[x.slug] || ""} onChange={(e) => onChange({ ...line, extras: { ...line.extras, [x.slug]: e.target.value } })} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function QuoteBuilder() {
  const { request, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const services = useLoad("/services");
  const options = useLoad("/bookings/options");
  const [form, setForm] = useState(EMPTY);
  const [lines, setLines] = useState([newLine()]);
  const [errors, setErrors] = useState({});
  const [price, setPrice] = useState(null);
  const [priceError, setPriceError] = useState("");
  const [busy, setBusy] = useState(false);
  const canOverride = can("owner", "manager");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  // Lines in the shape the server prices. Sized lines take the quote's property unless set per line.
  const items = useMemo(() => lines.filter((l) => l.serviceSlug).map((l) => {
    const custom = l.serviceSlug === "__custom";
    return {
      ...(custom ? { label: l.label } : { serviceSlug: l.serviceSlug }),
      propertyType: l.propertyType || form.propertyType,
      bedrooms: Number(l.bedrooms),
      bathrooms: Number(l.bathrooms),
      option: l.option,
      qty: Number(l.qty) || 1,
      unitPrice: l.unitPrice === "" ? undefined : Number(l.unitPrice),
      extras: Object.entries(l.extras).filter(([, q]) => Number(q) > 0).map(([slug, qty]) => ({ slug, qty: Number(qty) })),
    };
  }), [lines, form.propertyType]);

  const priceKey = JSON.stringify([items, form.supplies, form.discount]);
  useEffect(() => {
    if (!items.length) return setPrice(null);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      request("/admin/quotes/price", { method: "POST", signal: ctrl.signal, body: { items, supplies: form.supplies, discount: Number(form.discount) || 0 } })
        .then((p) => { setPrice(p); setPriceError(""); })
        .catch((e) => e.name !== "AbortError" && (setPrice(null), setPriceError(Object.values(e.details || {})[0] || e.message)));
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = {
        ...form, items, discount: Number(form.discount) || 0,
        bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms), kitchens: Number(form.kitchens), livingRooms: Number(form.livingRooms), stairs: Number(form.stairs),
      };
      const r = await request("/admin/quotes", { method: "POST", body });
      toast(form.send ? `Quote ${r.quote.quoteRef} emailed to ${r.quote.customer.email}` : `Quote ${r.quote.quoteRef} saved`);
      navigate(`/admin/quotes?open=${r.quote.quoteRef}`);
    } catch (err) {
      setErrors(err.details || {});
      toast(err.message, "error");
      setBusy(false);
      requestAnimationFrame(() => document.querySelector("[aria-invalid='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }

  if (services.loading || options.loading) return <Loading />;
  if (services.error || options.error) return <ErrorBox error={services.error || options.error} />;
  const o = options.data;

  return (
    <>
      <PageHeader title="Quote builder" subtitle="Build a quote from the price list and email it with an Accept button. Accepting books the clean." />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-extrabold text-white">Customer</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="q-first" label="First name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Input id="q-last" label="Last name" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
              <Input id="q-email" type="email" label="Email" value={form.email} onChange={set("email")} error={errors.email} />
              <Input id="q-phone" type="tel" label="Phone (optional)" placeholder="0803 123 4567" value={form.phone} onChange={set("phone")} error={errors.phone} />
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 font-extrabold text-white">Property</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select id="q-area" label="Area" placeholder="Choose area" options={o.areas} value={form.area} onChange={set("area")} error={errors.area} />
              <Input id="q-address" label="Address (optional)" value={form.address} onChange={set("address")} className="sm:col-span-2" />
              <Select id="q-pt" label="Property type" placeholder="Choose" options={o.propertyTypes} value={form.propertyType} onChange={set("propertyType")} />
              {["bedrooms", "bathrooms", "kitchens", "livingRooms", "stairs"].map((k) => (
                <Input key={k} id={`q-${k}`} type="number" min="0" max="20" label={{ livingRooms: "Living rooms" }[k] || k[0].toUpperCase() + k.slice(1)} value={form[k]} onChange={set(k)} />
              ))}
              <div className="flex items-end pb-2"><Toggle id="q-pets" label="Pets at home" checked={form.pets} onChange={set("pets")} /></div>
            </div>
          </Card>

          {lines.map((l, i) => (
            <LineEditor key={l.id} line={l} index={i} services={services.data} propertyTypes={o.propertyTypes} errors={errors} canOverride={canOverride}
              onChange={(nl) => setLines((ls) => ls.map((x) => (x.id === l.id ? nl : x)))}
              onRemove={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.id !== l.id) : [newLine()]))} />
          ))}
          <Button type="button" variant="secondary" icon={Plus} onClick={() => setLines((ls) => [...ls, newLine()])}>Add another line</Button>

          <Card>
            <h2 className="mb-4 font-extrabold text-white">Notes for the customer</h2>
            <TextArea id="q-notes" label="Notes (shown on the quote)" value={form.notes} onChange={set("notes")} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-6">
            <h2 className="mb-4 font-extrabold text-white">Total</h2>
            <div className="space-y-4">
              <Select id="q-supplies" label="Supplies" options={[{ value: "customer", label: "Customer provides" }, { value: "cleaniq", label: `Cleaniq brings (+${naira(services.data.suppliesFee)} per clean)` }]} value={form.supplies} onChange={set("supplies")} />
              {canOverride && (
                <div className="grid grid-cols-2 gap-3">
                  <Input id="q-dlabel" label="Discount name" value={form.discountLabel} onChange={set("discountLabel")} />
                  <Input id="q-discount" type="number" min="0" label="Discount (₦)" value={form.discount} onChange={set("discount")} />
                </div>
              )}
              <Input id="q-date" type="date" min={today()} label="Preferred date (optional)" value={form.serviceDate} onChange={set("serviceDate")} />
              <Select id="q-time" label="Preferred time (optional)" placeholder="—" options={TIMES.map((t) => ({ value: t, label: time12(t) }))} value={form.serviceTime} onChange={set("serviceTime")} />

              <div className="rounded-2xl bg-white/[0.04] p-4">
                {price ? (
                  <dl className="space-y-2 text-sm">
                    {price.items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <dt className="text-white/70">{it.service}{it.size ? ` — ${it.size}` : ""}{it.option ? ` (${it.option})` : ""}{it.qty > 1 ? ` × ${it.qty}` : ""}</dt>
                        <dd className="font-bold text-white">{naira(it.subtotal)}</dd>
                      </div>
                    ))}
                    {price.discount > 0 && <div className="flex justify-between text-emerald-300"><dt>{form.discountLabel || "Discount"}</dt><dd>−{naira(price.discount)}</dd></div>}
                    {price.vat?.enabled && <div className="flex justify-between text-white/60"><dt>{price.vat.label} ({price.vat.rate}%)</dt><dd>{naira(price.vat.amount)}</dd></div>}
                    <div className="flex justify-between border-t border-white/10 pt-2 text-base"><dt className="font-bold text-white">Total</dt><dd className="font-black text-emerald-300">{naira(price.grandTotal)}</dd></div>
                  </dl>
                ) : (
                  <p className="text-sm text-white/50">{priceError || "Choose a service to see the total."}</p>
                )}
              </div>
              <Toggle id="q-send" label="Email the quote to the customer now" checked={form.send} onChange={set("send")} />
              <Button type="submit" icon={Send} loading={busy} className="w-full" disabled={!price}>{form.send ? "Send quote" : "Save quote"}</Button>
              <p className="text-xs text-white/40">Valid for 30 days. When the customer accepts, they confirm the date and time and it becomes a booking.</p>
            </div>
          </Card>
        </div>
      </form>
    </>
  );
}
