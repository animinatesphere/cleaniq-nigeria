import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { COMPARE } from "../data";
import { EASE } from "../motion";
import { SectionHeading } from "./ui";

const COLS = [
  { key: "regular", label: "Regular", short: "Regular" },
  { key: "deep", label: "Deep", short: "Deep" },
  { key: "post", label: "Post-construction", short: "After build" },
];

function Mark({ on, delay }) {
  return on ? (
    <motion.span
      className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-primary text-white sm:h-8 sm:w-8"
      initial={{ scale: 0, rotate: -120 }}
      whileInView={{ scale: 1, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 300, damping: 15, delay }}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </motion.span>
  ) : (
    <span className="mx-auto grid h-7 w-7 place-items-center text-slate-300 sm:h-8 sm:w-8">
      <Minus className="h-4 w-4" />
    </span>
  );
}

export default function Compare() {
  return (
    <section id="compare" className="bg-white pb-20 sm:pb-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Compare"
          title="Which clean do I need?"
          text="Not sure where to start? Here's what each service covers. Most new customers start with a deep clean, then move to regular visits."
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mt-12 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_20px_60px_-20px_rgba(6,26,19,0.2)] ring-1 ring-slate-100 sm:mt-16"
        >
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="bg-ink text-white">
                <th className="w-[40%] px-3 py-4 text-[11px] font-bold tracking-wider uppercase sm:w-1/2 sm:px-8 sm:text-sm">What's included</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-0.5 py-4 text-center text-[11px] leading-tight font-bold break-words sm:px-2 sm:text-sm">
                    <span className="sm:hidden">{c.short}</span>
                    <span className="hidden sm:inline">{c.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, r) => (
                <motion.tr
                  key={row.task}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: r * 0.05, ease: EASE }}
                  className="border-t border-slate-100 transition-colors hover:bg-cream"
                >
                  <td className="px-3 py-3.5 text-[13px] leading-snug font-semibold text-slate-700 sm:px-8 sm:py-4 sm:text-base">{row.task}</td>
                  {COLS.map((c, ci) => (
                    <td key={c.key} className="px-1 py-3 text-center sm:px-2">
                      <Mark on={row[c.key]} delay={0.2 + r * 0.05 + ci * 0.08} />
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
