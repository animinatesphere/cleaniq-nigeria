// Admin login — cinematic: Lekki–Ikoyi Link Bridge at night (Unsplash), slow camera move, glass login card.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { DEMO, useAuth } from "../auth";
import { Button } from "../ui";
import { EASE } from "../../motion";
import wordmark from "../../assets/logo-wordmark-white-web.png";

const PHOTO = "/images/admin-login-lekki-bridge.jpg";
const LINES = ["Every booking.", "Every cleaner.", "Every naira."];

function LagosClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Lagos" });
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
  return (
    <div>
      <p className="font-mono text-3xl font-bold tracking-wider text-white tabular-nums sm:text-4xl">{time}</p>
      <p className="mt-1 text-sm text-white/60">{date} · Lagos (WAT)</p>
    </div>
  );
}

function GlassInput({ id, label, type = "text", value, onChange, autoComplete, right }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold tracking-[0.15em] text-white/60 uppercase">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
          className="w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-base text-white outline-none backdrop-blur-sm transition-colors placeholder:text-white/30 focus:border-emerald-300 focus:bg-white/[0.09]"
        />
        {right}
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <title>Admin login — Cleaniq Nigeria</title>

      {/* Cinematic photo: slow push-in and drift (Ken Burns) */}
      <motion.img
        src={PHOTO}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-[60%_center]"
        initial={{ scale: 1.25, opacity: 0, x: "2%" }}
        animate={{ scale: [1.25, 1.08], opacity: 1, x: ["2%", "-2%"] }}
        transition={{ scale: { duration: 22, ease: "easeOut" }, x: { duration: 22, ease: "easeInOut" }, opacity: { duration: 1.6 } }}
      />
      {/* Grade: dark vignette + brand green */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#061a13] via-transparent to-black/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(3,104,71,0.35),transparent_60%)]" />
      {/* Letterbox bars slide away like a film opening */}
      <motion.div className="absolute inset-x-0 top-0 z-20 bg-black" initial={{ height: "50%" }} animate={{ height: "0%" }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }} />
      <motion.div className="absolute inset-x-0 bottom-0 z-20 bg-black" initial={{ height: "50%" }} animate={{ height: "0%" }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }} />
      {/* Slow light sweep */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
        initial={{ left: "-40%" }}
        animate={{ left: "140%" }}
        transition={{ duration: 6, delay: 1.8, repeat: Infinity, repeatDelay: 7, ease: "easeInOut" }}
      />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        {/* Story side */}
        <div className="hidden lg:block">
          <motion.img src={wordmark} alt="Cleaniq Services" className="h-14 w-auto" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.8 }} />
          <motion.p initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.3em" }} transition={{ delay: 1.5, duration: 1.4 }} className="mt-10 text-xs font-bold text-emerald-300 uppercase">
            Cleaniq Nigeria · Control room
          </motion.p>
          <h1 className="mt-5 text-6xl leading-[1.02] font-extrabold tracking-tight text-white xl:text-7xl">
            {LINES.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-1">
                <motion.span
                  className={`block ${i === 2 ? "bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent" : ""}`}
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ delay: 1.6 + i * 0.18, duration: 1, ease: EASE }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 1 }} className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
            Bookings, cleaners, quotes and payments across Lagos — in one place.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.7, duration: 0.8 }} className="mt-12 flex items-end gap-10 border-t border-white/10 pt-6">
            <LagosClock />
          </motion.div>
        </div>

        {/* Login card */}
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 40, scale: 0.96, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ delay: 1.1, duration: 1, ease: EASE }}
          className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.07] p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-9"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <img src={wordmark} alt="Cleaniq Services" className="h-11 w-auto lg:hidden" />
          <div className="relative">
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200 lg:mt-0">
              <ShieldCheck className="h-3.5 w-3.5" /> Staff only
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">Welcome back</h2>
            <p className="mt-1.5 text-sm text-white/60">Log in to the Cleaniq Nigeria admin.</p>

            <div className="mt-8 space-y-5">
              <GlassInput id="email" label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <GlassInput
                id="password"
                label="Password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                right={
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            {error && (
              <motion.p role="alert" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [-8, 8, -4, 0] }} className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100">
                {error}
              </motion.p>
            )}

            <Button type="submit" loading={busy} icon={Lock} className="mt-7 w-full rounded-2xl py-4 text-base shadow-lg shadow-emerald-500/30">
              Log in securely
            </Button>
            {DEMO ? (
              <p className="mt-6 rounded-xl bg-amber-400/10 p-3 text-center text-xs font-semibold text-amber-200">Demo mode — sample data only. Type any email and password.</p>
            ) : (
              <p className="mt-6 text-center text-xs text-white/40">Forgotten your password? Ask the owner to reset it from Settings.</p>
            )}
          </div>
        </motion.form>
      </div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }} className="absolute right-5 bottom-4 z-10 text-[11px] text-white/35">
        Lekki–Ikoyi Link Bridge, Lagos · Photo: Unsplash
      </motion.p>
    </div>
  );
}
