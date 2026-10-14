// Form building blocks for the booking and quote forms. Every input has a label and its error message.
import { motion, AnimatePresence } from "framer-motion";
import { Check, Minus, Plus } from "lucide-react";

export function Field({ id, label, hint, error, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm font-bold text-ink">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 text-sm font-semibold text-rose-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClass = (error) =>
  `w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-base text-ink outline-none transition-colors placeholder:text-slate-400 focus:border-primary ${
    error ? "border-rose-300" : "border-slate-200"
  }`;

export function TextInput({ id, label, hint, error, className, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={inputClass(error)} {...props} />
    </Field>
  );
}

export function TextArea({ id, label, hint, error, className, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`${inputClass(error)} min-h-28 resize-y`} {...props} />
    </Field>
  );
}

export function Select({ id, label, hint, error, placeholder, options, className, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass(error)} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23036847%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:20px] bg-[right_14px_center] bg-no-repeat pr-11`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

// − 2 + stepper
export function Counter({ id, label, value, onChange, min = 0, max = 20, step = 1, format = (v) => v, error }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, Math.round(v * 2) / 2)));
  return (
    <Field id={id} error={error}>
      <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5">
        <span id={`${id}-label`} className="text-sm font-bold text-ink">
          {label}
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby={`${id}-label`}>
          <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Fewer ${label}`} className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary">
            <Minus className="h-4 w-4" />
          </button>
          <motion.output key={value} initial={{ scale: 1.3, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} id={id} aria-live="polite" className="min-w-14 text-center text-base font-extrabold text-ink">
            {format(value)}
          </motion.output>
          <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`More ${label}`} className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Field>
  );
}

// Pill buttons for a single choice. options: [{ value, label, sub }]
export function Chips({ id, label, value, onChange, options, error, columns = "grid-cols-2 sm:grid-cols-3" }) {
  return (
    <Field id={id} error={error}>
      <fieldset aria-describedby={error ? `${id}-error` : undefined}>
        {label && <legend className="mb-2 block text-sm font-bold text-ink">{label}</legend>}
        <div className={`grid gap-2.5 ${columns}`}>
          {options.map((o) => {
            const active = value === o.value;
            return (
              <motion.button
                type="button"
                key={String(o.value)}
                onClick={() => onChange(o.value)}
                aria-pressed={active}
                whileTap={{ scale: 0.96 }}
                className={`relative rounded-2xl border-2 px-3 py-3 text-left text-sm font-bold transition-colors ${
                  active ? "border-primary bg-primary text-white shadow-lg shadow-primary/25" : error ? "border-rose-200 bg-white text-slate-700" : "border-slate-200 bg-white text-slate-700 hover:border-primary/40"
                }`}
              >
                <span className="block">{o.label}</span>
                {o.sub && <span className={`mt-0.5 block text-xs font-semibold ${active ? "text-white/80" : "text-slate-500"}`}>{o.sub}</span>}
              </motion.button>
            );
          })}
        </div>
      </fieldset>
    </Field>
  );
}

// Big selectable card (services, supplies)
export function ChoiceCard({ active, onClick, title, sub, aside, icon }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${active ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-slate-200 bg-white hover:border-primary/40"}`}
    >
      {icon && <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-extrabold text-ink">{title}</span>
          {aside && <span className="shrink-0 text-sm font-extrabold text-primary">{aside}</span>}
        </span>
        {sub && <span className="mt-1 block text-sm leading-snug text-slate-600">{sub}</span>}
      </span>
      <span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${active ? "border-primary bg-primary text-white" : "border-slate-300"}`}>
        {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </motion.button>
  );
}
