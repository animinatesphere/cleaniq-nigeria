import { motion } from "framer-motion";
import { AUDIENCES } from "../data";
import { EASE } from "../motion";
import { Icon, SectionHeading, TiltCard, WipeImage } from "./ui";

export default function WhoWeServe() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Who we clean for"
          title="Built for the way Lagos lives and works"
          text="From family homes in Magodo to short-lets in Lekki and offices on the Island — one trusted team for every space."
        />

        <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {AUDIENCES.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}
            >
              <TiltCard className="group h-full rounded-[1.75rem] bg-cream p-3 ring-1 ring-primary/5 transition-shadow hover:shadow-[0_25px_60px_-20px_rgba(3,104,71,0.35)]">
                <div className="relative">
                  <WipeImage
                    src={a.image}
                    alt={a.title}
                    delay={0.15 + i * 0.12}
                    className="h-44 rounded-[1.25rem] sm:h-48"
                    imgClassName="transition-transform duration-700 group-hover:scale-110"
                  />
                  <motion.span
                    className="absolute -bottom-5 left-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30"
                    initial={{ scale: 0, rotate: -45 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.6 + i * 0.12 }}
                  >
                    <Icon name={a.icon} className="h-6 w-6" />
                  </motion.span>
                </div>
                <div className="px-3 pt-8 pb-4">
                  <h3 className="text-lg font-extrabold text-ink">{a.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.text}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
