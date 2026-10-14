import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { FEATURES } from "../data";
import { Icon, SectionHeading } from "./ui";
import { EASE } from "../motion";

export default function WhyUs() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-4, 4]);

  return (
    <section id="why-us" ref={ref} className="relative overflow-hidden bg-ink py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(3,104,71,0.55),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(110,231,183,0.18),transparent_40%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <motion.div style={{ rotate }} className="absolute -inset-4 rounded-[2.75rem] border-2 border-dashed border-mint/30" />
          <div className="relative aspect-square overflow-hidden rounded-[2.5rem]">
            <motion.img
              style={{ y }}
              src="/images/happy-cleaner.jpg"
              alt="Smiling cleaner wearing yellow gloves"
              loading="lazy"
              className="absolute inset-x-0 -top-[10%] h-[120%] w-full object-cover object-[30%_center]"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="absolute -bottom-6 -right-2 rounded-3xl bg-mint px-6 py-5 text-ink shadow-2xl sm:-right-6"
          >
            <p className="text-3xl font-extrabold">Lagos</p>
            <p className="text-sm font-bold opacity-70">born & based</p>
          </motion.div>
        </div>

        <div>
          <SectionHeading
            light
            center={false}
            eyebrow="Why Cleaniq"
            title="A clean you can trust, every single time"
            text="We built Cleaniq for busy Lagos professionals, families and businesses who want reliable cleaning without the follow-up."
          />
          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30, rotateY: -25 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
                style={{ transformPerspective: 800 }}
                whileHover={{ y: -6, backgroundColor: "rgba(255,255,255,0.09)" }}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-mint">
                  <Icon name={f.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
