// Staff create a booking for a customer (phone/WhatsApp bookings). Price comes from the server.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth, useLoad } from "../auth";
import { Button, Card, ErrorBox, Input, Loading, PageHeader, Select, TextArea, Toggle, naira, time12, useToast } from "../ui";

const TIMES = [];
for (let m = 8 * 60; m <= 18 * 60; m += 30) TIMES.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const today = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10); // Lagos

const EMPTY = {
  firstName: "", lastName: "", email: "", phone: "", area: "", address: "", landmark: "",
  service: "", supplies: "customer", propertyType: "", bedrooms: 1, bathrooms: 1, kitchens: 1, livingRooms: 1, stairs: 0,
  pets: false, parking: "", access: "", instructions: "", date: "", time: "09:00", extras: {}, payment: "paystack", offlineMethod: "Bank transfer", offlineNote: "", sendEmail: true,
};

export default function NewBooking() {
  const { request, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const services = useLoad("/services");
  const options = useLoad("/bookings/options");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [price, setPrice] = useState(null);
  const [priceError, setPriceError] = useState("");
  const [busy, setBusy] = useState(false);

  const base = (services.data?.base || []).filter((s) => s.pricing === "size");
  const extras = useMemo(() => Object.entries(form.extras).filter(([, q]) => Number(q) > 0).map(([slug, qty]) => ({ slug, qty: Number(qty) })), [form.extras]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const priceKey = JSON.stringify([form.service, form.propertyType, form.bedrooms, form.bathrooms, extras, form.supplies]);
  useEffect(() => {
    if (!form.service || !form.propertyType) return setPrice(null);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      request("/admin/bookings/price", { method: "POST", signal: ctrl.signal, body: { service: form.service, propertyType: form.propertyType, bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms), extras, supplies: form.supplies } })
        .then((p) => {
          setPrice(p);
          setPriceError("");
        })
        .catch((e) => e.name !== "AbortError" && (setPrice(null), setPriceError(Object.values(e.details || {})[0] || e.message)));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...form, extras, bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms), kitchens: Number(form.kitchens), livingRooms: Number(form.livingRooms), stairs: Number(form.stairs) };
      const r = await request("/admin/bookings", { method: "POST", body });
      toast(r.paymentLink ? "Booking created — payment link emailed" : "Booking created");
      navigate(`/admin/bookings/${r.booking.bookingId}`);
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
      <PageHeader title="New booking" subtitle="For bookings taken by phone or WhatsApp. Prices come from the price list." />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-extrabold text-white">Customer</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="firstName" label="First name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Input id="lastName" label="Last name" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
              <Input id="email" type="email" label="Email" value={form.email} onChange={set("email")} error={errors.email} />
              <Input id="phone" type="tel" label="Phone" placeholder="0803 123 4567" value={form.phone} onChange={set("phone")} error={errors.phone} />
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 font-extrabold text-white">Where & what</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select id="area" label="Area" placeholder="Choose area" options={o.areas} value={form.area} onChange={set("area")} error={errors.area} />
              <Input id="address" label="Address" value={form.address} onChange={set("address")} error={errors.address} />
              <Input id="landmark" label="Landmark (optional)" value={form.landmark} onChange={set("landmark")} className="sm:col-span-2" />
              <Select id="service" label="Service" placeholder="Choose service" options={base.map((s) => ({ value: s.slug, label: s.fromPrice ? `${s.name} — from ${naira(s.fromPrice)}` : s.name }))} value={form.service} onChange={set("service")} error={errors.service} />
              <Select id="supplies" label="Supplies" options={[{ value: "customer", label: "Customer provides" }, { value: "cleaniq", label: `Cleaniq brings (+${naira(services.data.suppliesFee)})` }]} value={form.supplies} onChange={set("supplies")} error={errors.supplies} />
            </div>
          </Card>
          <Card>
            <h2 className="mb-1 font-extrabold text-white">Property & access</h2>
            <p className="mb-4 text-xs text-white/50">The price comes from the price list for this property type and number of bedrooms (0 = self-contain).</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select id="propertyType" label="Property type" placeholder="Choose" options={o.propertyTypes} value={form.propertyType} onChange={set("propertyType")} error={errors.propertyType} />
              {["bedrooms", "bathrooms", "kitchens", "livingRooms", "stairs"].map((k) => (
                <Input key={k} id={k} type="number" min="0" max="20" label={{ livingRooms: "Living rooms" }[k] || k[0].toUpperCase() + k.slice(1)} value={form[k]} onChange={set(k)} error={errors[k]} />
              ))}
              <Select id="parking" label="Parking" placeholder="—" options={o.parking} value={form.parking} onChange={set("parking")} />
              <Select id="access" label="Access" placeholder="—" options={o.access} value={form.access} onChange={set("access")} />
              <div className="flex items-end pb-2">
                <Toggle id="pets" label="Pets at home" checked={form.pets} onChange={set("pets")} />
              </div>
              <TextArea id="instructions" label="Instructions" value={form.instructions} onChange={set("instructions")} className="sm:col-span-3" />
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 font-extrabold text-white">Add-ons</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.data.extras.map((x) => (
                <Input key={x.slug} id={`x-${x.slug}`} type="number" min="0" max="20" label={`${x.name} · ${naira(x.rate)}`} value={form.extras[x.slug] || ""} placeholder="0" onChange={(e) => setForm((f) => ({ ...f, extras: { ...f.extras, [x.slug]: e.target.value } }))} />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 font-extrabold text-white">Date & payment</h2>
            <div className="space-y-4">
              <Input id="date" type="date" min={today()} label="Date" value={form.date} onChange={set("date")} error={errors.date} />
              <Select id="time" label="Arrival time" options={TIMES.map((t) => ({ value: t, label: time12(t) }))} value={form.time} onChange={set("time")} error={errors.time} />
              <Select
                id="payment"
                label="Payment"
                options={[
                  { value: "paystack", label: "Email a Paystack payment link" },
                  ...(can("owner", "manager") ? [
                    { value: "offline", label: "Already paid (cash / transfer)" },
                    { value: "payAfter", label: "Pay after the clean (invoice the day after)" },
                    { value: "weekly", label: "Weekly bill (invoiced every week)" },
                  ] : []),
                  { value: "later", label: "Take payment later" },
                ]}
                value={form.payment}
                onChange={set("payment")}
              />
              {form.payment === "offline" && (
                <>
                  <Select id="offlineMethod" label="Paid by" options={["Bank transfer", "Cash", "POS", "Other"]} value={form.offlineMethod} onChange={set("offlineMethod")} />
                  <Input id="offlineNote" label="Payment note" value={form.offlineNote} onChange={set("offlineNote")} />
                </>
              )}
              {form.payment !== "later" && <Toggle id="sendEmail" label="Email the customer" checked={form.sendEmail} onChange={set("sendEmail")} />}
            </div>
          </Card>
          <Card className="lg:sticky lg:top-6">
            <h2 className="mb-3 font-extrabold text-white">Price</h2>
            {priceError ? (
              <p className="text-sm text-rose-300">{priceError}</p>
            ) : price ? (
              <dl className="space-y-1.5 text-sm">
                {price.lines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-3">
                    <dt className="text-white/60">
                      {l.label}
                      {l.qty > 1 ? ` × ${l.qty}` : ""}
                    </dt>
                    <dd className="text-white">{naira(l.amount)}</dd>
                  </div>
                ))}
                {price.vat.enabled && (
                  <div className="flex justify-between">
                    <dt className="text-white/60">{price.vat.label} {price.vat.rate}%</dt>
                    <dd className="text-white">{naira(price.vat.amount)}</dd>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-base font-extrabold">
                  <dt>Total</dt>
                  <dd className="text-emerald-300">{naira(price.total)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-white/50">Choose a service and the property type.</p>
            )}
            <Button type="submit" loading={busy} className="mt-5 w-full py-3" disabled={!price}>
              Create booking
            </Button>
          </Card>
        </div>
      </form>
    </>
  );
}
