import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PLANS, whatsappLink } from "../data";
import { EASE } from "../motion";
import { Icon, SectionHeading, TiltCard } from "./ui";

export default function Plans() {
  return (
    <section id="plans" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Cleaning plans"
          title="Clean on your schedule"
          text="Book once, or set up a regular slot and never think about it again. You can change or pause your plan any time."
        />

        <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
            >
              <TiltCard
                className={`group relative flex h-full flex-col rounded-[1.75rem] p-7 transition-shadow ${
                  p.featured
                    ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-2xl shadow-primary/30"
                    : "bg-cream text-ink ring-1 ring-primary/5 hover:shadow-xl hover:shadow-primary/10"
                }`}
              >
                {p.featured && (
                  <motion.span
                    className="absolute -top-3 right-6 rounded-full bg-mint px-3 py-1 text-xs font-extrabold text-ink"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Best for families
                  </motion.span>
                )}
                <motion.span
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${p.featured ? "bg-white/15 text-mint" : "bg-primary text-white"}`}
                >
                  <Icon name={p.icon} className="h-6 w-6" />
                </motion.span>
                <h3 className="mt-6 text-2xl font-extrabold">{p.title}</h3>
                <p className={`mt-3 flex-1 text-sm leading-relaxed ${p.featured ? "text-white/80" : "text-slate-600"}`}>{p.text}</p>
                <a
                  href={whatsappLink(`Hi Cleaniq, I'm interested in a ${p.title.toLowerCase()} cleaning plan in Lagos.`)}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-6 inline-flex items-center gap-2 text-sm font-bold ${p.featured ? "text-mint" : "text-primary"}`}
                >
                  Get a quote
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
                </a>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
