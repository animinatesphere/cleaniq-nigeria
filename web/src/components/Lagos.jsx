import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { LAGOS_AREAS, whatsappLink } from "../data";
import { Reveal } from "./ui";

function Marquee({ items, reverse = false }) {
  const row = [...items, ...items];
  return (
    <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        className="flex shrink-0 gap-4 pr-4"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
      >
        {row.map((area, i) => (
          <span
            key={`${area}-${i}`}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold sm:px-5 sm:py-2.5 sm:text-base whitespace-nowrap text-white backdrop-blur"
          >
            <MapPin className="h-4 w-4 text-mint" />
            {area}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function Lagos() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.2, 1.05, 1.2]);
  const half = Math.ceil(LAGOS_AREAS.length / 2);

  return (
    <section id="lagos" ref={ref} className="relative overflow-hidden py-20 sm:py-40">
      <motion.img
        style={{ y, scale }}
        src="/images/lagos-aerial.jpg"
        alt="Aerial view of Lagos"
        loading="lazy"
        className="absolute inset-x-0 -top-[15%] h-[130%] w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/90 via-primary-dark/80 to-ink/95" />

      <div className="relative mx-auto max-w-7xl px-5 text-center sm:px-8">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-mint uppercase">
            <MapPin className="h-3.5 w-3.5" /> Starting in Lagos
          </span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mx-auto mt-6 max-w-3xl text-[2.1rem] leading-tight font-extrabold tracking-tight text-balance text-white sm:text-6xl">
            Proudly cleaning <span className="text-mint">Lagos</span> — Island to Mainland
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/75 sm:mt-6 sm:text-lg">
            We're launching across Lagos first, with more Nigerian cities coming soon. Don't see your area? Send us a message.
          </p>
        </Reveal>
      </div>

      <div className="relative mt-10 space-y-3 sm:mt-14 sm:space-y-4">
        <Marquee items={LAGOS_AREAS.slice(0, half)} />
        <Marquee items={LAGOS_AREAS.slice(half)} reverse />
      </div>

      <Reveal delay={0.2} className="relative mt-14 text-center">
        <a
          href={whatsappLink("Hi Cleaniq, do you cover my area in Lagos?")}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-2 rounded-full bg-mint px-8 py-4 font-bold text-ink shadow-xl transition-transform hover:-translate-y-1"
        >
          Check my area
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </a>
      </Reveal>
    </section>
  );
}
