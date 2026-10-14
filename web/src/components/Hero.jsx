import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CalendarCheck, Check, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { EASE } from "../motion";

const MotionLink = motion.create(Link);
const ROTATING = ["homes.", "offices.", "short-lets.", "new builds."];
const TICKER = ["Regular cleaning", "Deep cleaning", "Post-construction cleaning", "Lagos Island", "Lagos Mainland", "Homes", "Offices", "Short-lets"];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % ROTATING.length), 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="relative grid overflow-hidden">
      {/* invisible widest word reserves the space so the line doesn't jump */}
      <span className="invisible col-start-1 row-start-1">short-lets.</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={ROTATING[i]}
          className="col-start-1 row-start-1 text-primary"
          initial={{ y: "100%", opacity: 0, rotateX: -60 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: "-100%", opacity: 0, rotateX: 60 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {ROTATING[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Ticker() {
  const row = [...TICKER, ...TICKER];
  return (
    <div className="relative -mx-6 mt-16 -rotate-1 bg-primary py-4 shadow-xl shadow-primary/20 sm:mt-24">
      <div className="flex overflow-hidden">
        <motion.div
          className="flex shrink-0 items-center gap-8 pr-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        >
          {row.map((t, i) => (
            <span key={i} className="flex shrink-0 items-center gap-8 text-base font-bold whitespace-nowrap text-white sm:text-lg">
              {t}
              <span className="h-2 w-2 rounded-full bg-mint" />
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section id="top" ref={ref} className="relative overflow-hidden bg-cream pt-24 pb-10 sm:pt-36 sm:pb-14">
      {/* drifting background glows */}
      <motion.div
        className="pointer-events-none absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-mint/30 blur-3xl sm:h-[36rem] sm:w-[36rem]"
        animate={{ scale: [1, 1.15, 1], x: [0, -40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-primary/15 blur-3xl sm:h-[30rem] sm:w-[30rem]"
        animate={{ scale: [1.1, 1, 1.1], y: [0, -30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#03684712_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <motion.div style={{ y: textY, opacity: fade }}>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm sm:text-sm"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            Now booking in Lagos
          </motion.span>

          <h1 className="mt-6 text-[2.75rem] leading-[1.08] font-extrabold tracking-tight text-ink sm:mt-7 sm:text-6xl xl:text-7xl">
            {["Spotless", null, "Zero stress."].map((line, i) => (
              <span key={i} className="block overflow-hidden pb-1">
                <motion.span
                  className="block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: EASE }}
                >
                  {line ?? <RotatingWord />}
                </motion.span>
              </span>
            ))}
          </h1>

          <svg viewBox="0 0 300 20" className="-mt-1 h-3 w-48 text-mint sm:h-4 sm:w-72" aria-hidden>
            <motion.path
              d="M4 14 C 80 2, 200 2, 296 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.9, ease: EASE }}
            />
          </svg>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
            className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:mt-6 sm:text-xl"
          >
            Professional <strong className="text-ink">regular</strong>, <strong className="text-ink">deep</strong> and{" "}
            <strong className="text-ink">post-construction</strong> cleaning for homes and offices across Lagos. Book in minutes on WhatsApp.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
            className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-4"
          >
            <MotionLink
              to="/booking"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-primary px-8 py-4 font-bold text-white shadow-xl shadow-primary/30"
            >
              <motion.span
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ left: ["-40%", "140%"] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
              />
              Book now
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </MotionLink>
            <motion.a
              href="#services"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink/10 bg-white px-8 py-4 font-bold text-ink transition-colors hover:border-primary hover:text-primary"
            >
              Our services
            </motion.a>
          </motion.div>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.95 } } }}
            className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600 sm:mt-10 sm:gap-x-6"
          >
            {[
              [ShieldCheck, "Vetted cleaners"],
              [CalendarCheck, "Weekend slots"],
              [MapPin, "Island & Mainland"],
            ].map(([I, t]) => (
              <motion.li
                key={t}
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                className="flex items-center gap-2"
              >
                <I className="h-5 w-5 shrink-0 text-primary" /> {t}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* image side */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 3, clipPath: "inset(0 0 100% 0 round 2.5rem)" }}
            animate={{ opacity: 1, scale: 1, rotate: 0, clipPath: "inset(0 0 0% 0 round 2.5rem)" }}
            transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
            className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl shadow-primary/25 ring-4 ring-white sm:rounded-[2.5rem] sm:ring-8"
          >
            <motion.img
              style={{ y: imgY }}
              src="/images/hero-mopping.jpg"
              alt="Cleaner mopping a bright, modern living room"
              className="absolute inset-x-0 -top-[20%] h-[125%] w-full object-cover object-[35%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent" />
          </motion.div>

          {/* floating card: job done */}
          <motion.div
            initial={{ opacity: 0, x: -40, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16, delay: 1.1 }}
            className="absolute bottom-5 left-3 sm:bottom-10 sm:-left-10"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-2xl sm:p-4 sm:pr-6"
            >
              <motion.span
                className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white sm:h-11 sm:w-11"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 1.5 }}
              >
                <Check className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={3} />
              </motion.span>
              <div>
                <p className="text-xs font-extrabold text-ink sm:text-sm">Deep clean complete</p>
                <p className="text-[11px] font-medium text-slate-500 sm:text-xs">Lekki Phase 1 · 3-bed flat</p>
              </div>
            </motion.div>
          </motion.div>

          {/* floating card: team badge */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16, delay: 1.3 }}
            className="absolute top-5 right-3 sm:top-10 sm:-right-8"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-3 rounded-2xl bg-ink p-2.5 pr-4 text-white shadow-2xl sm:p-3 sm:pr-5"
            >
              <img src="/images/happy-cleaner.jpg" alt="" className="h-10 w-10 rounded-xl object-cover object-[30%_center] sm:h-12 sm:w-12" />
              <div>
                <p className="text-xs font-extrabold sm:text-sm">Vetted & trained</p>
                <p className="mt-0.5 text-[11px] font-semibold text-mint sm:text-xs">The Cleaniq team</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <Ticker />
    </section>
  );
}
