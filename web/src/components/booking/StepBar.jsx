import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "../../motion";

// Step indicator with an animated progress line. steps: [{ title, icon: Component }]
export default function StepBar({ steps, current, onJump }) {
  const pct = (current / (steps.length - 1)) * 100;
  return (
    <nav aria-label="Booking steps" className="relative">
      <div className="absolute top-5 right-[12.5%] left-[12.5%] h-1 rounded-full bg-primary/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-mint" animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: EASE }} />
      </div>
      <ol className="relative grid grid-cols-4">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = s.icon;
          return (
            <li key={s.title} className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => done && onJump(i)}
                disabled={!done}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}${done ? " (done — go back)" : ""}`}
                className="disabled:cursor-default"
              >
                <motion.span
                  animate={{ scale: active ? 1.12 : 1 }}
                  className={`grid h-11 w-11 place-items-center rounded-2xl ring-4 ring-cream transition-colors ${
                    active ? "bg-primary text-white shadow-lg shadow-primary/30" : done ? "bg-mint text-ink" : "bg-white text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" />}
                </motion.span>
              </button>
              <span className={`mt-2 text-[11px] leading-tight font-bold sm:text-sm ${active ? "text-primary" : done ? "text-ink" : "text-slate-400"}`}>{s.title}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
