import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { FAQS } from "../data";
import { Reveal, SectionHeading } from "./ui";
import { EASE } from "../motion";

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-8">
        <SectionHeading eyebrow="FAQ" title="Questions? We've got answers" />
        <div className="mt-10 space-y-3 sm:mt-14 sm:space-y-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.06} y={24}>
                <div
                  className={`overflow-hidden rounded-3xl bg-white ring-1 transition-shadow ${
                    isOpen ? "shadow-xl shadow-primary/10 ring-primary/30" : "ring-slate-100"
                  }`}
                >
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:gap-6 sm:px-8 sm:py-5"
                  >
                    <span className="text-base font-bold text-ink sm:text-lg">{item.q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3 }}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        isOpen ? "bg-primary text-white" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Plus className="h-5 w-5" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      >
                        <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600 sm:px-8 sm:pb-6 sm:text-base">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
