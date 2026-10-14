import { motion } from "framer-motion";
import { ArrowUpRight, Check } from "lucide-react";
import { SERVICES, whatsappLink } from "../data";
import { Icon, SectionHeading, TiltCard } from "./ui";
import { EASE } from "../motion";

function ServiceCard({ service, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 60, rotateX: 12 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay: index * 0.15, ease: EASE }}
      style={{ transformPerspective: 1000 }}
    >
    <TiltCard
      className="group flex h-full flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_-20px_rgba(6,26,19,0.18)] ring-1 ring-slate-100 transition-shadow hover:shadow-[0_30px_80px_-20px_rgba(3,104,71,0.35)]"
    >
      <div className="relative h-52 sm:h-60">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={service.image}
            alt={service.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        </div>
        <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
          0{index + 1}
        </span>
        <motion.span
          className="absolute -bottom-7 right-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/40"
          whileHover={{ rotate: -10, scale: 1.1 }}
        >
          <Icon name={service.icon} className="h-7 w-7" />
        </motion.span>
        <p className="absolute bottom-4 left-5 text-sm font-semibold text-white/90">{service.tagline}</p>
      </div>

      <div className="flex flex-1 flex-col p-6 pt-9 sm:p-7 sm:pt-9">
        <h3 className="text-2xl font-extrabold text-ink">{service.title}</h3>
        <p className="mt-3 leading-relaxed text-slate-600">{service.description}</p>

        <ul className="mt-6 grid gap-2.5">
          {service.includes.map((item, i) => (
            <motion.li
              key={item}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + index * 0.15 + i * 0.06 }}
              className="flex items-start gap-2.5 text-sm text-slate-700"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {item}
            </motion.li>
          ))}
        </ul>

        <a
          href={whatsappLink(`Hi Cleaniq, I'd like to book ${service.title.toLowerCase()} in Lagos.`)}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center justify-between rounded-full bg-cream px-6 py-3.5 text-sm font-bold sm:text-base text-primary transition-colors group-hover:bg-primary group-hover:text-white"
        >
          Book {service.title.split(" ")[0].toLowerCase()} clean
          <ArrowUpRight className="h-5 w-5 transition-transform group-hover:rotate-45" />
        </a>
      </div>
    </TiltCard>
    </motion.article>
  );
}

export default function Services() {
  return (
    <section id="services" className="relative bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Our services"
          title="Three ways we make your space shine"
          text="Whether it's weekly upkeep, a full reset or the mess after builders leave — we've got Lagos homes and offices covered."
        />
        <div className="mt-12 sm:mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.id} service={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
