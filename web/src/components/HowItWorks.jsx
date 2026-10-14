import { motion } from "framer-motion";
import { STEPS } from "../data";
import { Icon, SectionHeading } from "./ui";
import { EASE } from "../motion";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Booked in minutes, cleaned in hours"
          text="No apps to download, no long forms. Just a quick chat and we take it from there."
        />

        <div className="relative mt-14 sm:mt-20">
          {/* connecting line that draws itself on scroll */}
          <div className="absolute top-10 right-[12.5%] left-[12.5%] hidden h-1 rounded-full bg-primary/10 lg:block">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 1.6, ease: EASE }}
              className="h-full origin-left rounded-full bg-gradient-to-r from-primary to-mint"
            />
          </div>

          <ol className="grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.2, ease: EASE }}
                className="relative text-center"
              >
                <motion.div
                  initial={{ rotate: -20, scale: 0.6 }}
                  whileInView={{ rotate: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 + i * 0.2 }}
                  whileHover={{ scale: 1.1, rotate: 6 }}
                  className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white text-primary shadow-xl shadow-primary/15 ring-1 ring-primary/10"
                >
                  <Icon name={step.icon} className="h-9 w-9" />
                  <span className="absolute -top-3 -right-3 grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-extrabold text-white ring-4 ring-cream">
                    {i + 1}
                  </span>
                </motion.div>
                <h3 className="mt-7 text-xl font-extrabold text-ink">{step.title}</h3>
                <p className="mx-auto mt-3 max-w-xs leading-relaxed text-slate-600">{step.text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
