// Shared building blocks: scroll-reveal, wipe-reveal images, tilt cards, section heading, icon lookup.
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Bath, BedDouble, Briefcase, BrushCleaning, Building2, CalendarCheck, CalendarClock, CalendarDays, Check,
  ClipboardList, HardHat, House, KeyRound, MessageCircle, Repeat, ShieldCheck, Smile, Sofa, SprayCan,
  UtensilsCrossed, Wallet,
} from "lucide-react";
import { EASE } from "../motion";

// Icons referenced by name from data.js.
const ICONS = {
  Bath, BedDouble, Briefcase, BrushCleaning, Building2, CalendarCheck, CalendarClock, CalendarDays, ClipboardList,
  HardHat, House, KeyRound, MessageCircle, Repeat, ShieldCheck, Smile, Sofa, SprayCan, UtensilsCrossed, Wallet,
};

export function Icon({ name, ...props }) {
  const Cmp = ICONS[name] ?? Check;
  return <Cmp {...props} />;
}

export function Reveal({ children, delay = 0, y = 40, className = "", as = "div" }) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </M>
  );
}

// Image revealed by a "wipe" sweeping across it, like a squeegee on glass.
export function WipeImage({ src, alt, className = "", imgClassName = "", delay = 0, direction = "left" }) {
  const from = direction === "left" ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
  return (
    <motion.div
      className={`relative overflow-hidden ${className}`}
      initial={{ clipPath: from }}
      whileInView={{ clipPath: "inset(0 0% 0 0%)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.1, delay, ease: EASE }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        initial={{ scale: 1.25 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 1.6, delay, ease: EASE }}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      <motion.span
        aria-hidden
        className="absolute inset-y-0 w-2 bg-mint/80 blur-[2px]"
        initial={{ left: direction === "left" ? "0%" : "100%", opacity: 1 }}
        whileInView={{ left: direction === "left" ? "100%" : "0%", opacity: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 1.1, delay, ease: EASE }}
      />
    </motion.div>
  );
}

// Card that tilts toward the pointer on desktop. Touch devices just get the hover lift.
export function TiltCard({ children, className = "", ...rest }) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [7, -7]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-7, 7]), { stiffness: 200, damping: 20 });

  function onMove(e) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
  }
  function reset() {
    x.set(0.5);
    y.set(0.5);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, text, light = false, center = true }) {
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-2xl`}>
      <Reveal>
        <span
          className={`inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] ${
            light ? "bg-white/10 text-mint" : "bg-primary/10 text-primary"
          }`}
        >
          <motion.span
            className={`h-0.5 rounded-full ${light ? "bg-mint" : "bg-primary"}`}
            initial={{ width: 0 }}
            whileInView={{ width: 16 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          />
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={0.1}>
        <h2
          className={`mt-5 text-[2rem] leading-tight font-extrabold tracking-tight text-balance sm:text-5xl ${
            light ? "text-white" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {text && (
        <Reveal delay={0.2}>
          <p className={`mt-4 text-base leading-relaxed sm:mt-5 sm:text-lg ${light ? "text-white/70" : "text-slate-600"}`}>{text}</p>
        </Reveal>
      )}
    </div>
  );
}
