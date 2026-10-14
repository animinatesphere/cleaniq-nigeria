import { motion } from "framer-motion";
import { GALLERY } from "../data";
import { SectionHeading, WipeImage } from "./ui";
import { EASE } from "../motion";

export default function Gallery() {
  return (
    <section id="gallery" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Every corner"
          title="From kitchens to whole estates"
          text="Flats, duplexes, terraces and offices — we clean every room, surface and finish with the same care."
        />

        <div className="mt-12 sm:mt-16 grid auto-rows-[140px] grid-cols-2 gap-3 sm:auto-rows-[200px] sm:gap-4 md:auto-rows-[220px] md:grid-cols-4 md:gap-5">
          {GALLERY.map((item, i) => (
            <motion.figure
              key={item.src}
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
              className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl ${item.span}`}
            >
              <WipeImage
                src={item.src}
                alt={item.label}
                delay={i * 0.08}
                direction={i % 2 ? "right" : "left"}
                className="h-full w-full"
                imgClassName="transition-transform duration-[900ms] ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/0 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
              <figcaption className="absolute bottom-3 left-3 flex items-center gap-2 text-sm font-bold text-white sm:bottom-5 sm:left-5 sm:text-lg">
                <span className="h-2 w-2 rounded-full bg-mint transition-all duration-500 group-hover:w-6" />
                {item.label}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
