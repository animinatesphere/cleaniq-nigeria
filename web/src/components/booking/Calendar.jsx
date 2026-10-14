// Month calendar for picking a date between min and max ("YYYY-MM-DD", Lagos dates from the server).
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "../../lib/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function Calendar({ value, onChange, min, max, error }) {
  const start = value || min;
  const [view, setView] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const [dir, setDir] = useState(1);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthKey = `${view.y}-${pad(view.m + 1)}`;
  const canPrev = monthKey > min.slice(0, 7);
  const canNext = monthKey < max.slice(0, 7);
  const move = (delta) => {
    setDir(delta);
    setView(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };

  return (
    <div className={`rounded-3xl border-2 bg-white p-4 sm:p-5 ${error ? "border-rose-300" : "border-slate-200"}`}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-extrabold text-ink" aria-live="polite">
          {MONTHS[view.m]} {view.y}
        </p>
        <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold tracking-wide text-slate-400 uppercase">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="relative mt-2 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={monthKey}
            custom={dir}
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-7 gap-1"
          >
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const date = ymd(view.y, view.m, d);
              const disabled = date < min || date > max;
              const selected = date === value;
              return (
                <button
                  type="button"
                  key={date}
                  disabled={disabled}
                  onClick={() => onChange(date)}
                  aria-pressed={selected}
                  aria-label={new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                  className={`aspect-square rounded-xl text-sm font-bold transition-colors ${
                    selected ? "bg-primary text-white shadow-lg shadow-primary/30" : disabled ? "text-slate-300" : "text-ink hover:bg-primary/10"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
