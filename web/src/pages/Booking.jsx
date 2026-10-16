// /booking — 4-step booking form with a live summary. The server prices everything and creates the
// Paystack payment; this page only collects choices. The form is saved in the browser between visits.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarCheck, HardHat, House, KeyRound, Loader2, Lock, MapPin, PackageCheck, SprayCan, UserRound } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { naira } from "../lib/format";
import { EASE } from "../motion";
import StepBar from "../components/booking/StepBar";
import Calendar from "../components/booking/Calendar";
import SummaryCard from "../components/booking/SummaryCard";
import { ChoiceCard, Chips, Counter, Field, Select, TextArea, TextInput } from "../components/booking/fields";
import { whatsappLink } from "../data";

const DRAFT_KEY = "cleaniq-ng-booking-v1";
const STEPS = [
  { title: "Location & service", icon: MapPin },
  { title: "Property", icon: House },
  { title: "Extras & access", icon: KeyRound },
  { title: "Date & pay", icon: CalendarCheck },
];
const SERVICE_ICONS = { "regular-cleaning": House, "deep-cleaning": SprayCan, "post-construction-cleaning": HardHat };

const EMPTY = {
  area: "", address: "", landmark: "",
  service: "",
  propertyType: "", bedrooms: 1, bathrooms: 1, kitchens: 1, livingRooms: 1, stairs: 0, pets: null,
  extras: {}, supplies: "", parking: "", access: "", instructions: "",
  date: "", time: "", firstName: "", lastName: "", email: "", phone: "",
};

// Which step each field lives on (to jump back when the server finds a problem).
const FIELD_STEP = {
  area: 0, address: 0, landmark: 0, service: 0,
  propertyType: 1, bedrooms: 1, bathrooms: 1, kitchens: 1, livingRooms: 1, stairs: 1, rooms: 1, pets: 1,
  extras: 2, supplies: 2, parking: 2, access: 2, instructions: 2,
  date: 3, time: 3, firstName: 3, lastName: 3, email: 3, phone: 3,
};

// No saved progress: refreshing the page starts the booking again from the beginning.
// (Clear anything an older version of the site saved in this browser.)
function clearOldDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode — fine */
  }
}

const isNgMobile = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  const local = d.startsWith("234") ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
  return /^[789][01]\d{8}$/.test(local);
};

// Until the Get a Quote page is live, quote requests go to WhatsApp with the details so far.
function quoteMessage(f) {
  const bits = [f.propertyType && `${f.bedrooms === 0 ? "self-contain" : `${f.bedrooms}-bed`} ${f.propertyType.toLowerCase()}`, f.area].filter(Boolean).join(" in ");
  return `Hi Cleaniq, I'd like a quote${bits ? ` for a ${bits}` : ""}.`;
}

// Same rules as the server, so people see problems before pressing Next.
function validateStep(step, f, service, needsQuote) {
  const e = {};
  if (step === 0) {
    if (!f.area) e.area = "Please choose your area in Lagos";
    if (f.address.trim().length < 5) e.address = "Please enter your full address";
    if (!service) e.service = "Please choose a service";
  }
  if (step === 1) {
    if (!f.propertyType) e.propertyType = "Please choose your property type";
    else if (needsQuote) e.propertyType = "This property needs a quote — tap “Request a free quote” in the summary";
    if (f.bedrooms + f.bathrooms + f.kitchens + f.livingRooms < 1) e.rooms = "Please add at least one room to clean";
    if (typeof f.pets !== "boolean") e.pets = "Please let us know if you have pets";
  }
  if (step === 2) {
    if (!f.supplies) e.supplies = "Please tell us who's providing the cleaning supplies";
    if (!f.parking) e.parking = "Please tell us about parking";
    if (!f.access) e.access = "Please tell us how the cleaner gets in";
  }
  if (step === 3) {
    if (!f.date) e.date = "Please choose a date";
    if (!f.time) e.time = "Please choose an arrival time";
    if (f.firstName.trim().length < 2) e.firstName = "Please enter your first name";
    if (f.lastName.trim().length < 2) e.lastName = "Please enter your last name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Please enter a valid email address";
    if (!isNgMobile(f.phone)) e.phone = "Please enter a Nigerian mobile number, e.g. 0803 123 4567";
  }
  return e;
}

export default function Booking() {
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => {
    clearOldDraft();
    const pre = params.get("service");
    return pre ? { ...EMPTY, service: pre } : EMPTY;
  });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState({});
  const [catalog, setCatalog] = useState(null); // { base, extras, suppliesFee }
  const [options, setOptions] = useState(null); // { areas, propertyTypes, parking, access, timeSlots, minDate, maxDate }
  const [loadError, setLoadError] = useState("");
  const [price, setPrice] = useState(null);
  const [priceState, setPriceState] = useState({ loading: false, error: "", needsQuote: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const topRef = useRef(null);

  // Price list + form options from the server.
  useEffect(() => {
    let alive = true;
    Promise.all([api("/services"), api("/bookings/options")])
      .then(([c, o]) => {
        if (!alive) return;
        // Bookable online: services priced by property size. Others (post-construction) are quoted.
        setCatalog({ ...c, base: c.base.filter((s) => s.pricing === "size"), quoteOnly: c.base.filter((s) => s.pricing === "quote") });
        setOptions(o);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const service = catalog?.base.find((s) => s.slug === form.service) || null;
  const quoteServices = catalog?.quoteOnly || [];
  const quoteLink = () => whatsappLink(quoteMessage(form));

  // Drop a saved date that's now in the past.
  useEffect(() => {
    if (options && form.date && (form.date < options.minDate || form.date > options.maxDate)) setForm((f) => ({ ...f, date: "" }));
  }, [options, form.date]);


  // Live price from the server whenever a price-affecting choice changes.
  const extrasList = useMemo(() => Object.entries(form.extras).filter(([, q]) => q > 0).map(([slug, qty]) => ({ slug, qty })), [form.extras]);
  const priceKey = JSON.stringify([form.service, form.propertyType, form.bedrooms, form.bathrooms, extrasList, form.supplies]);
  useEffect(() => {
    if (!service || !form.propertyType) {
      setPrice(null);
      setPriceState({ loading: false, error: "", needsQuote: false });
      return;
    }
    const ctrl = new AbortController();
    setPriceState((p) => ({ ...p, loading: true }));
    const t = setTimeout(() => {
      api("/bookings/quote-price", {
        method: "POST",
        signal: ctrl.signal,
        body: { service: form.service, propertyType: form.propertyType, bedrooms: form.bedrooms, bathrooms: form.bathrooms, extras: extrasList, supplies: form.supplies || "customer" },
      })
        .then((p) => {
          setPrice(p);
          setPriceState({ loading: false, error: "", needsQuote: false });
        })
        .catch((e) => {
          if (e.name === "AbortError") return;
          setPrice(null);
          const needsQuote = Boolean(e.details?.needsQuote);
          setPriceState({ loading: false, error: needsQuote ? e.details.propertyType || e.details.service : e.message, needsQuote });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey, service]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const rest = { ...e };
      delete rest[key];
      if (["bedrooms", "bathrooms", "kitchens", "livingRooms"].includes(key)) delete rest.rooms;
      return rest;
    });
  };
  const onInput = (key) => (e) => set(key)(e.target.value);
  const setExtra = (slug, qty) => setForm((f) => ({ ...f, extras: { ...f.extras, [slug]: qty } }));

  function goTo(next) {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setErrors({});
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function next() {
    const e = validateStep(step, form, service, priceState.needsQuote);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector("[aria-invalid='true'], [role='alert']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    goTo(step + 1);
  }

  async function pay() {
    const e = validateStep(3, form, service);
    setErrors(e);
    setSubmitError("");
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const res = await api("/bookings", {
        method: "POST",
        body: {
          ...form,
          address: form.address.trim(), landmark: form.landmark.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(),
          extras: extrasList,
        },
      });
      try {
        localStorage.setItem(`${DRAFT_KEY}-pending`, res.bookingId);
      } catch {
        /* ignore */
      }
      window.location.assign(res.authorizationUrl);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.details && Object.keys(err.details).length) {
        setErrors(err.details);
        const first = Math.min(...Object.keys(err.details).map((k) => FIELD_STEP[k] ?? 3));
        if (first !== step) {
          setDir(-1);
          setStep(first);
        }
        setSubmitError("Please fix the highlighted details.");
      } else {
        setSubmitError(err.message);
      }
    }
  }

  return (
    <section className="min-h-screen bg-cream pt-24 pb-20 sm:pt-32">
      <title>Book a clean — Cleaniq Nigeria</title>
      <meta name="description" content="Book regular, deep or post-construction cleaning in Lagos. See your price instantly and pay securely with Paystack." />

      <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-24 px-4 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="text-center">
          <h1 className="text-[2rem] leading-tight font-extrabold tracking-tight text-ink sm:text-5xl">Book your clean</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">Four quick steps. One fixed price per clean based on your home — you'll pay securely with Paystack.</p>
        </motion.div>

        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <StepBar steps={STEPS} current={step} onJump={goTo} />
        </div>

        {loadError ? (
          <div role="alert" className="mx-auto mt-10 max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg">
            <p className="font-bold text-ink">We couldn't load the booking form.</p>
            <p className="mt-2 text-sm text-slate-600">{loadError}</p>
            <button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-primary px-6 py-3 font-bold text-white">
              Try again
            </button>
          </div>
        ) : !catalog || !options ? (
          <div className="mt-16 flex justify-center" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 sm:mt-10 lg:grid-cols-[1fr_360px] lg:gap-8">
            <div className="overflow-hidden rounded-[1.75rem] bg-white p-5 shadow-[0_20px_60px_-20px_rgba(6,26,19,0.18)] ring-1 ring-slate-100 sm:p-8">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={step}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
                    Step {step + 1} of 4
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-ink">{STEPS[step].title}</h2>

                  {step === 0 && (
                    <div className="mt-6 space-y-6">
                      <Select id="area" label="Area in Lagos" placeholder="Choose your area" options={options.areas} value={form.area} onChange={onInput("area")} error={errors.area} />
                      <TextInput id="address" label="Full address" placeholder="House number, street, estate" autoComplete="street-address" value={form.address} onChange={onInput("address")} error={errors.address} />
                      <TextInput id="landmark" label="Nearest landmark (optional)" placeholder="e.g. opposite the filling station" value={form.landmark} onChange={onInput("landmark")} />

                      <Field id="service" error={errors.service}>
                        <fieldset>
                          <legend className="mb-2 block text-sm font-bold text-ink">Service</legend>
                          <div className="grid gap-3">
                            {catalog.base.map((s) => {
                              const Icon = SERVICE_ICONS[s.slug] || SprayCan;
                              return (
                                <ChoiceCard
                                  key={s.slug}
                                  active={form.service === s.slug}
                                  onClick={() => set("service")(s.slug)}
                                  title={s.name}
                                  sub={s.description}
                                  aside={s.fromPrice ? `from ${naira(s.fromPrice)}` : undefined}
                                  icon={<Icon className="h-5 w-5" />}
                                />
                              );
                            })}
                          </div>
                        </fieldset>
                      </Field>

                      {quoteServices.length > 0 && (
                        <div className="rounded-2xl border-2 border-dashed border-primary/25 bg-cream p-4">
                          <p className="text-sm font-bold text-ink">{quoteServices.map((s) => s.name).join(", ")}</p>
                          <p className="mt-1 text-sm text-slate-600">Priced per job after a quick look at the space.</p>
                          <a href={quoteLink()} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">
                            Request a free quote <ArrowRight className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 1 && (
                    <div className="mt-6 space-y-6">
                      <Chips
                        id="propertyType"
                        label="Property type"
                        value={form.propertyType}
                        onChange={set("propertyType")}
                        error={errors.propertyType}
                        options={options.propertyTypes.map((p) => ({ value: p, label: p }))}
                      />
                      <Field id="rooms" error={errors.rooms}>
                        <p className="mb-2 text-sm font-bold text-ink">Rooms to clean</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Counter id="bedrooms" label="Bedrooms" value={form.bedrooms} onChange={set("bedrooms")} format={(v) => (v === 0 ? "Self-contain" : v)} />
                          <Counter id="bathrooms" label="Bathrooms" value={form.bathrooms} onChange={set("bathrooms")} />
                          <Counter id="kitchens" label="Kitchens" value={form.kitchens} onChange={set("kitchens")} />
                          <Counter id="livingRooms" label="Living rooms" value={form.livingRooms} onChange={set("livingRooms")} />
                          <Counter id="stairs" label="Staircases" value={form.stairs} onChange={set("stairs")} max={10} />
                        </div>
                      </Field>
                      <Chips
                        id="pets"
                        label="Any pets at home?"
                        value={form.pets}
                        onChange={set("pets")}
                        error={errors.pets}
                        columns="grid-cols-2"
                        options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]}
                      />
                    </div>
                  )}

                  {step === 2 && (
                    <div className="mt-6 space-y-7">
                      <div>
                        <p className="text-sm font-bold text-ink">Add-ons (optional)</p>
                        <div className="mt-2 grid gap-3">
                          {catalog.extras.map((x) => (
                            <Counter
                              key={x.slug}
                              id={`extra-${x.slug}`}
                              label={`${x.name} · ${naira(x.rate)}${x.unitLabel ? ` per ${x.unitLabel}` : ""}`}
                              value={form.extras[x.slug] || 0}
                              onChange={(q) => setExtra(x.slug, q)}
                              max={20}
                            />
                          ))}
                        </div>
                      </div>

                      <Field id="supplies" error={errors.supplies}>
                        <fieldset>
                          <legend className="mb-2 block text-sm font-bold text-ink">Who provides cleaning supplies & equipment?</legend>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <ChoiceCard
                              active={form.supplies === "cleaniq"}
                              onClick={() => set("supplies")("cleaniq")}
                              title="Cleaniq brings them"
                              sub="Professional products and equipment"
                              aside={catalog.suppliesFee ? `+${naira(catalog.suppliesFee)}` : "Free"}
                              icon={<PackageCheck className="h-5 w-5" />}
                            />
                            <ChoiceCard
                              active={form.supplies === "customer"}
                              onClick={() => set("supplies")("customer")}
                              title="I'll provide them"
                              sub="We'll use your products and mop/vacuum"
                              aside="Free"
                              icon={<House className="h-5 w-5" />}
                            />
                          </div>
                        </fieldset>
                      </Field>

                      <Chips id="parking" label="Parking" value={form.parking} onChange={set("parking")} error={errors.parking} columns="grid-cols-1 sm:grid-cols-3" options={options.parking.map((p) => ({ value: p, label: p }))} />
                      <Chips id="access" label="How does the cleaner get in?" value={form.access} onChange={set("access")} error={errors.access} columns="grid-cols-1 sm:grid-cols-3" options={options.access.map((p) => ({ value: p, label: p }))} />
                      <TextArea id="instructions" label="Special instructions (optional)" placeholder="Anything we should know — gate code, areas to focus on, things not to touch…" maxLength={1000} value={form.instructions} onChange={onInput("instructions")} />
                    </div>
                  )}

                  {step === 3 && (
                    <div className="mt-6 space-y-7">
                      <Field id="date" label="Date" error={errors.date}>
                        <Calendar value={form.date} onChange={set("date")} min={options.minDate} max={options.maxDate} error={errors.date} />
                      </Field>
                      <Chips
                        id="time"
                        label="Arrival time"
                        value={form.time}
                        onChange={set("time")}
                        error={errors.time}
                        columns="grid-cols-3 sm:grid-cols-5"
                        options={options.timeSlots.map((s) => {
                          const [h, m] = s.split(":").map(Number);
                          return { value: s, label: `${h % 12 || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}` };
                        })}
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextInput id="firstName" label="First name" autoComplete="given-name" value={form.firstName} onChange={onInput("firstName")} error={errors.firstName} />
                        <TextInput id="lastName" label="Last name" autoComplete="family-name" value={form.lastName} onChange={onInput("lastName")} error={errors.lastName} />
                        <TextInput id="email" type="email" label="Email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={form.email} onChange={onInput("email")} error={errors.email} />
                        <Field id="phone" label="Phone (WhatsApp)" error={errors.phone}>
                          <div className={`flex overflow-hidden rounded-2xl border-2 bg-white focus-within:border-primary ${errors.phone ? "border-rose-300" : "border-slate-200"}`}>
                            <span className="grid place-items-center bg-cream px-3 text-sm font-bold text-primary">+234</span>
                            <input
                              id="phone"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel-national"
                              placeholder="803 123 4567"
                              aria-invalid={Boolean(errors.phone)}
                              aria-describedby={errors.phone ? "phone-error" : undefined}
                              value={form.phone}
                              onChange={onInput("phone")}
                              className="w-full min-w-0 px-3 py-3.5 text-base text-ink outline-none placeholder:text-slate-400"
                            />
                          </div>
                        </Field>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {submitError && (
                  <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {submitError}
                  </motion.p>
                )}
              </AnimatePresence>

              {price && step < 3 && (
                <p className="mt-6 flex items-center justify-between rounded-2xl bg-cream px-4 py-3 text-sm lg:hidden" aria-live="polite">
                  <span className="font-semibold text-slate-600">Total so far</span>
                  <span className="text-lg font-extrabold text-ink">{naira(price.total)}</span>
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                {step > 0 ? (
                  <button type="button" onClick={() => goTo(step - 1)} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-bold text-slate-600 hover:text-primary">
                    <ArrowLeft className="h-5 w-5" /> Back
                  </button>
                ) : (
                  <span />
                )}
                {step < 3 ? (
                  <motion.button type="button" onClick={next} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/30">
                    Continue <ArrowRight className="h-5 w-5" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={pay}
                    disabled={submitting || !price}
                    whileHover={{ scale: submitting ? 1 : 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/30 disabled:opacity-70"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                    {submitting ? "Taking you to Paystack…" : `Pay ${price ? naira(price.total) : ""} with Paystack`}
                  </motion.button>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-28">
              <SummaryCard
                form={form}
                service={service}
                quoteLink={quoteLink()}
                price={price}
                priceLoading={priceState.loading}
                priceError={priceState.error}
                needsQuote={priceState.needsQuote}
                suppliesChosen={Boolean(form.supplies)}
              />
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/70 p-4 text-sm text-slate-600 ring-1 ring-slate-100">
                <UserRound className="h-5 w-5 shrink-0 text-primary" />
                <span>Questions? Chat with us on WhatsApp — the green button at the bottom of the screen.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
