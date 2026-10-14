import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { whatsappLink } from "../data";
import { EASE } from "../motion";
import { Reveal, WipeImage } from "./ui";

const PERKS = ["Steady, flexible work across Lagos", "Training and professional equipment", "Paid on time, every time", "Grow with a fast-growing team"];

export default function JoinTeam() {
  return (
    <section id="careers" className="overflow-hidden bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div className="relative order-2 lg:order-1">
          <WipeImage
            src="/images/shelf-clean.jpg"
            alt="Cleaner dusting a shelf"
            className="aspect-[4/3] rounded-[2rem] shadow-2xl shadow-primary/20"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.8 }}
            className="absolute -top-5 right-4 rounded-2xl bg-mint px-5 py-3 text-ink shadow-xl sm:-right-5"
          >
            <p className="text-sm font-extrabold">We're hiring in Lagos</p>
          </motion.div>
        </div>

        <div className="order-1 lg:order-2">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-primary uppercase">
              <span className="h-0.5 w-4 rounded-full bg-primary" /> Join our team
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-5 text-[2rem] leading-tight font-extrabold tracking-tight text-balance text-ink sm:text-5xl">
              Love a spotless finish? Work with Cleaniq.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
              We're building a team of reliable, detail-loving cleaners across Lagos. If you take pride in your work, we'd love to hear from you.
            </p>
          </Reveal>
          <ul className="mt-7 space-y-3">
            {PERKS.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1, ease: EASE }}
                className="flex items-center gap-3 font-semibold text-slate-700"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-white">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                {p}
              </motion.li>
            ))}
          </ul>
          <Reveal delay={0.5}>
            <motion.a
              href={whatsappLink("Hi Cleaniq, I'd like to apply to work as a cleaner in Lagos.")}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-8 py-4 font-bold text-white sm:w-auto"
            >
              Apply to join
              <ArrowRight className="h-5 w-5" />
            </motion.a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
