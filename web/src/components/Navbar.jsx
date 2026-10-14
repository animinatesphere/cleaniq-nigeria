import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Menu, X } from "lucide-react";
import { whatsappLink } from "../data";
import { EASE } from "../motion";
// Web-sized copy of logo-wordmark-white.png (the original is 8078px wide / 476 KB).
import wordmark from "../assets/logo-wordmark-white-web.png";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#rooms", label: "Checklist" },
  { href: "#plans", label: "Plans" },
  { href: "#lagos", label: "Areas" },
  { href: "#faq", label: "FAQ" },
];

// White wordmark — only place it on a dark/green background.
export function Logo({ className = "h-11 sm:h-14" }) {
  return (
    <a href="#top" className="flex shrink-0 items-center" aria-label="Cleaniq Services — home">
      <motion.img
        src={wordmark}
        alt="Cleaniq Services"
        className={`w-auto ${className}`}
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      />
    </a>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-primary-dark/95 shadow-[0_8px_30px_rgba(6,26,19,0.25)] backdrop-blur-xl" : "bg-primary"
      }`}
    >
      <motion.div style={{ scaleX: progress }} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-mint" />
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
        <Logo />
        <ul className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative rounded-full px-3.5 py-2 text-sm font-semibold text-white/85 transition-colors hover:text-white"
              >
                {l.label}
                <span className="absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-mint transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <motion.a
            href={whatsappLink()}
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="hidden rounded-full bg-mint px-6 py-3 text-sm font-bold text-ink shadow-lg shadow-ink/20 transition-colors hover:bg-white sm:inline-flex"
          >
            Book a clean
          </motion.a>
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "x" : "menu"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden border-t border-white/10 bg-primary-dark lg:hidden"
          >
            <ul className="space-y-1 px-4 py-5">
              {LINKS.map((l, i) => (
                <motion.li key={l.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <a onClick={() => setOpen(false)} href={l.href} className="block rounded-xl px-4 py-3 font-semibold text-white/85 hover:bg-white/10 hover:text-white">
                    {l.label}
                  </a>
                </motion.li>
              ))}
              <li className="pt-2">
                <a href={whatsappLink()} target="_blank" rel="noreferrer" className="block rounded-full bg-mint px-6 py-3.5 text-center font-bold text-ink">
                  Book a clean
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
