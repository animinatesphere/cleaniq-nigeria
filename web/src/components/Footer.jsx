import { motion } from "framer-motion";
import { Link } from "react-router";
import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { CONTACT, SERVICES, whatsappLink } from "../data";
import { Logo } from "./Navbar";
import { EASE } from "../motion";

const YEAR = new Date().getFullYear();

function CTA() {
  return (
    <section className="relative bg-white px-4 py-16 sm:px-8 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary-dark to-ink px-6 py-14 sm:rounded-[2.5rem] text-center text-white shadow-2xl shadow-primary/30 sm:px-16 sm:py-20"
      >
        <motion.div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-mint/30 blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl"
          animate={{ scale: [1.3, 1, 1.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <h2 className="relative mx-auto max-w-2xl text-[2rem] leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
          Ready for a cleaner, calmer home?
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-base text-white/75 sm:text-lg">
          Tell us what you need and get a quote today. Regular, deep or post-construction — anywhere in Lagos.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
          <motion.a
            href={whatsappLink()}
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-mint px-8 py-4 font-bold text-ink shadow-xl"
          >
            <MessageCircle className="h-5 w-5" /> Book on WhatsApp
          </motion.a>
          <motion.a
            href={`tel:+${CONTACT.whatsapp}`}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 font-bold text-white hover:bg-white/10"
          >
            <Phone className="h-5 w-5" /> Call us
          </motion.a>
        </div>
      </motion.div>
    </section>
  );
}

export default function Footer({ showCta = true }) {
  return (
    <>
      {showCta && <CTA />}
      <footer className="bg-ink text-white/70">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:px-8 sm:py-16 lg:grid-cols-4 lg:gap-12">
          <div className="col-span-2 lg:col-span-1">
            <Logo className="h-16" />
            <p className="mt-5 max-w-xs leading-relaxed">
              Professional regular, deep and post-construction cleaning for Lagos homes and businesses.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Services</h3>
            <ul className="mt-5 space-y-3">
              {SERVICES.map((s) => (
                <li key={s.id}>
                  <Link to="/#services" className="group inline-flex items-center gap-1 hover:text-mint">
                    {s.title}
                    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white">Company</h3>
            <ul className="mt-5 space-y-3">
              <li><Link to="/#how-it-works" className="hover:text-mint">How it works</Link></li>
              <li><Link to="/#why-us" className="hover:text-mint">Why Cleaniq</Link></li>
              <li><Link to="/#plans" className="hover:text-mint">Cleaning plans</Link></li>
              <li><Link to="/#careers" className="hover:text-mint">Join our team</Link></li>
              <li><Link to="/#lagos" className="hover:text-mint">Areas we cover</Link></li>
              <li><Link to="/#faq" className="hover:text-mint">FAQ</Link></li>
              <li><Link to="/blog" className="hover:text-mint">Blog</Link></li>
              <li><Link to="/contact" className="hover:text-mint">Contact us</Link></li>
            </ul>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <h3 className="font-bold text-white">Contact</h3>
            <ul className="mt-5 space-y-3">
              <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-mint" /> {CONTACT.city}</li>
              <li>
                <a href={`tel:+${CONTACT.whatsapp}`} className="flex items-center gap-3 hover:text-mint">
                  <Phone className="h-4 w-4 text-mint" /> {CONTACT.phoneDisplay}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 hover:text-mint">
                  <Mail className="h-4 w-4 text-mint" /> {CONTACT.email}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-6 pr-24 text-sm sm:px-8">© {YEAR} Cleaniq Nigeria. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
