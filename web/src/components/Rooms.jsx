import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { ROOMS } from "../data";
import { EASE } from "../motion";
import { Icon, Reveal, SectionHeading } from "./ui";

export default function Rooms() {
  const [active, setActive] = useState(ROOMS[0].id);
  const room = ROOMS.find((r) => r.id === active);

  return (
    <section id="rooms" className="relative overflow-hidden bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Room by room"
          title="Our cleaning checklist"
          text="Every visit follows a clear checklist, so nothing gets missed. Tap a room to see what we cover."
        />

        <Reveal delay={0.2} className="mt-10 sm:mt-14">
          <div>
            <div className="mx-auto grid grid-cols-2 gap-1.5 rounded-3xl bg-white p-1.5 shadow-lg shadow-primary/10 ring-1 ring-primary/5 sm:flex sm:w-max sm:gap-2 sm:rounded-full">
              {ROOMS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActive(r.id)}
                  className={`relative flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors sm:px-6 sm:py-3 ${
                    active === r.id ? "text-white" : "text-slate-600 hover:text-primary"
                  }`}
                >
                  {active === r.id && (
                    <motion.span
                      layoutId="room-pill"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon name={r.icon} className="relative h-4 w-4" />
                  <span className="relative">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-8 grid items-center gap-8 sm:mt-12 lg:grid-cols-2 lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-2xl shadow-primary/20">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={room.image}
                src={room.image}
                alt={room.label}
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ clipPath: "inset(0 0 0 100%)", scale: 1.15 }}
                animate={{ clipPath: "inset(0 0 0 0%)", scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: EASE }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
            <AnimatePresence mode="wait">
              <motion.p
                key={room.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
                className="absolute bottom-5 left-6 text-2xl font-extrabold text-white sm:text-3xl"
              >
                {room.label}
              </motion.p>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.ul
              key={room.id}
              initial="hidden"
              animate="show"
              exit="exit"
              variants={{
                show: { transition: { staggerChildren: 0.07 } },
                exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
              }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
            >
              {room.tasks.map((t) => (
                <motion.li
                  key={t}
                  variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { ease: EASE, duration: 0.5 } } }}
                  whileHover={{ x: 6 }}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100"
                >
                  <motion.span
                    variants={{ hidden: { scale: 0 }, show: { scale: 1, transition: { type: "spring", stiffness: 400, damping: 15 } } }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </motion.span>
                  {t}
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
