// /contact — cinematic opening, the quickest ways to reach us, a message form (goes to admin → Chat
// support and is answered by email), opening hours and the areas we cover.
import { useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Check, Clock, Loader2, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { CONTACT, LAGOS_AREAS, whatsappLink } from "../data";
import { api } from "../lib/api";
import { EASE } from "../motion";

const TOPICS = ["A clean for my home", "Short-let / Airbnb", "Office or business", "Post-construction", "Monthly plan", "An existing booking", "Something else"];
const HOURS = [["Monday – Friday", "7:00am – 7:00pm"], ["Saturday", "8:00am – 6:00pm"], ["Sunday", "Messages only"]];

function Opening() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative flex min-h-[78svh] items-end overflow-hidden bg-ink pt-24">
      <motion.img style={{ y }} src="/images/office-team.jpg" alt="" className="absolute inset-0 h-[120%] w-full object-cover"
        initial={{ scale: 1.2, filter: "blur(8px)" }} animate={{ scale: 1, filter: "blur(0px)" }} transition={{ duration: 2.2, ease: EASE }} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/25" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,26,19,0.85))]" />
      <motion.div style={{ opacity: fade }} className="relative mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8 sm:pb-24">
        <motion.p initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.3em" }} transition={{ duration: 1.4, delay: 0.4, ease: EASE }}
          className="mb-5 flex items-center gap-3 text-xs font-bold text-mint uppercase sm:text-sm">
          <span className="h-px w-10 bg-mint" /> Contact us
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 50, clipPath: "inset(0 0 100% 0)" }} animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 1.2, delay: 0.6, ease: EASE }}
          className="max-w-3xl text-[2.6rem] leading-[1.03] font-extrabold tracking-tight text-white sm:text-7xl">
          Let's talk about your <span className="text-mint">clean.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.1, ease: EASE }} className="mt-6 max-w-xl text-base text-white/75 sm:text-lg">
          Questions, prices, a big job or a booking you'd like to change — our Lagos team usually replies within the hour.
        </motion.p>
      </motion.div>
    </section>
  );
}

function Ways() {
  const ways = [
    { icon: MessageCircle, title: "WhatsApp", text: "The fastest way to reach us", action: "Chat now", href: whatsappLink(), external: true, hot: true },
    { icon: Phone, title: "Call us", text: CONTACT.phoneDisplay, action: "Call", href: `tel:+${CONTACT.whatsapp}` },
    { icon: Mail, title: "Email", text: CONTACT.email, action: "Send an email", href: `mailto:${CONTACT.email}` },
  ];
  return (
    <section className="relative z-10 -mt-12 bg-[linear-gradient(to_bottom,transparent_3rem,var(--color-cream)_3rem)] px-4 sm:-mt-16 sm:bg-[linear-gradient(to_bottom,transparent_4rem,var(--color-cream)_4rem)] sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
        {ways.map((w, i) => (
          <motion.a key={w.title} href={w.href} target={w.external ? "_blank" : undefined} rel={w.external ? "noopener noreferrer" : undefined}
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.2 + i * 0.12, ease: EASE }} whileHover={{ y: -6 }}
            className={`group flex items-center gap-4 rounded-[1.75rem] p-6 shadow-[0_24px_60px_-24px_rgba(6,26,19,0.45)] ring-1 transition-colors ${w.hot ? "bg-primary text-white ring-primary" : "bg-white text-ink ring-slate-100"}`}>
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${w.hot ? "bg-mint text-ink" : "bg-primary/10 text-primary"}`}><w.icon className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold">{w.title}</span>
              <span className={`block truncate text-sm ${w.hot ? "text-white/75" : "text-slate-500"}`}>{w.text}</span>
            </span>
            <ArrowUpRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 ${w.hot ? "text-mint" : "text-primary"}`} />
          </motion.a>
        ))}
      </div>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      {children}
      {error && <span role="alert" className="mt-1 block text-sm font-semibold text-rose-600">{error}</span>}
    </label>
  );
}
const input = (bad) => `w-full rounded-2xl border bg-white px-4 py-3.5 text-ink outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 ${bad ? "border-rose-400" : "border-slate-200"}`;

function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: TOPICS[0], message: "", website: "" });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [problem, setProblem] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!f.name.trim()) errs.name = "Please enter your name";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = "Please enter a valid email";
    if (f.message.trim().length < 5) errs.message = "Please tell us a little more";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState("sending");
    try {
      await api("/support", { method: "POST", body: f });
      setState("sent");
    } catch (err) {
      if (err.status === 400) { setErrors(err.details || {}); setState("idle"); return; }
      setProblem(err.message);
      setState("error");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_30px_80px_-30px_rgba(6,26,19,0.3)] ring-1 ring-slate-100 sm:p-10">
      <AnimatePresence mode="wait">
        {state === "sent" ? (
          <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }} className="py-10 text-center">
            <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-white shadow-xl shadow-primary/30"><Check className="h-10 w-10" strokeWidth={3} /></motion.span>
            <h3 className="mt-6 text-3xl font-extrabold text-ink">Message sent!</h3>
            <p className="mx-auto mt-3 max-w-sm text-slate-600">Thanks, {f.name.split(" ")[0]}. We'll reply to <strong>{f.email}</strong> shortly. Need us sooner? Message us on WhatsApp.</p>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-bold text-white"><MessageCircle className="h-4 w-4" />WhatsApp us</a>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Send us a message</h2>
              <p className="mt-2 text-slate-600">We'll reply by email — usually within the hour during opening times.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" error={errors.name}><input className={input(errors.name)} value={f.name} onChange={set("name")} autoComplete="name" placeholder="Adaeze Okafor" /></Field>
              <Field label="Phone (optional)"><input className={input()} value={f.phone} onChange={set("phone")} type="tel" autoComplete="tel" placeholder="0803 123 4567" /></Field>
            </div>
            <Field label="Email" error={errors.email}><input className={input(errors.email)} value={f.email} onChange={set("email")} type="email" autoComplete="email" placeholder="you@example.com" /></Field>
            <div>
              <span className="mb-2 block text-sm font-bold text-ink">What's it about?</span>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button key={t} type="button" onClick={() => setF((x) => ({ ...x, subject: t }))}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${f.subject === t ? "text-white" : "bg-cream text-slate-700 hover:text-ink"}`}>
                    {f.subject === t && <motion.span layoutId="topic" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                    <span className="relative">{t}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Message" error={errors.message}>
              <textarea className={`${input(errors.message)} min-h-36 resize-y`} value={f.message} onChange={set("message")} placeholder="Tell us about the property, the area and when you'd like the clean." />
            </Field>
            {/* Spam trap: hidden from people, bots fill it in. */}
            <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden />
            {state === "error" && (
              <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                {problem} You can also <a className="font-bold underline" href={whatsappLink(`Hi Cleaniq, ${f.message}`)} target="_blank" rel="noopener noreferrer">send this on WhatsApp</a>.
              </p>
            )}
            <motion.button type="submit" disabled={state === "sending"} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-extrabold text-white shadow-xl shadow-primary/25 disabled:opacity-60 sm:w-auto">
              {state === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {state === "sending" ? "Sending…" : "Send message"}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Contact() {
  return (
    <>
      <title>Contact us — Cleaniq Nigeria</title>
      <meta name="description" content="Contact Cleaniq Nigeria on WhatsApp, by phone or email. Professional home, short-let and office cleaning across Lagos." />
      <Opening />
      <Ways />
      <section className="bg-cream px-4 pt-20 pb-24 sm:px-8 sm:pt-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.4fr_1fr]">
          <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, ease: EASE }}>
            <ContactForm />
          </motion.div>
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }}
              className="rounded-[2rem] bg-ink p-8 text-white">
              <h3 className="flex items-center gap-2 text-xl font-extrabold"><Clock className="h-5 w-5 text-mint" />Opening hours</h3>
              <dl className="mt-6 space-y-4">
                {HOURS.map(([d, h]) => (
                  <div key={d} className="flex justify-between gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    <dt className="text-white/70">{d}</dt><dd className="font-bold">{h}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-sm text-white/55">Book online any time — 24/7.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
              className="rounded-[2rem] bg-white p-8 ring-1 ring-slate-100">
              <h3 className="flex items-center gap-2 text-xl font-extrabold text-ink"><MapPin className="h-5 w-5 text-primary" />Where we clean</h3>
              <p className="mt-2 text-sm text-slate-600">Across {CONTACT.city.split(",")[0]} — the Island and the Mainland, including:</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {LAGOS_AREAS.map((a, i) => (
                  <motion.span key={a} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.03 }}
                    className="rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-primary">{a}</motion.span>
                ))}
              </div>
              <p className="mt-5 text-sm text-slate-500">Not listed? Message us — we probably still cover you.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.3, ease: EASE }}>
              <Link to="/booking" className="group flex items-center justify-between rounded-[2rem] bg-mint p-8 text-ink">
                <span><span className="block text-xl font-extrabold">Ready to book?</span><span className="text-sm text-ink/70">See your price and book in minutes.</span></span>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-mint transition-transform group-hover:rotate-45"><ArrowUpRight className="h-5 w-5" /></span>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
