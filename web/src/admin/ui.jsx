// One set of admin components (dark green, like the UK admin): page header, stat cards, tables that become
// cards on phones, modals, badges, buttons, form fields, loading/empty/error states, toasts.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from "lucide-react";

export const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const shortDate = (s) => (s ? new Date(`${String(s).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
export const dateTime = (s) => (s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }) : "—");
export const time12 = (s) => {
  if (!/^\d{2}:\d{2}$/.test(s || "")) return "";
  const [h, m] = s.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
};

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-white/8 bg-adm-card p-5 ${className}`}>{children}</div>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "emerald", onClick }) {
  const tones = { emerald: "bg-emerald-400/15 text-emerald-300", amber: "bg-amber-400/15 text-amber-300", sky: "bg-sky-400/15 text-sky-300", rose: "bg-rose-400/15 text-rose-300" };
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -3 } : undefined}
      className="rounded-2xl border border-white/8 bg-adm-card p-5 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-wider text-white/50 uppercase">{label}</p>
        {Icon && (
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
    </Tag>
  );
}

const BADGE = {
  Pending: "bg-amber-400/15 text-amber-300", Confirmed: "bg-sky-400/15 text-sky-300", Assigned: "bg-indigo-400/15 text-indigo-300",
  "In Progress": "bg-violet-400/15 text-violet-300", Completed: "bg-emerald-400/15 text-emerald-300", Cancelled: "bg-rose-400/15 text-rose-300",
  Paid: "bg-emerald-400/15 text-emerald-300", "Refund pending": "bg-amber-400/15 text-amber-300", Refunded: "bg-white/10 text-white/70", Failed: "bg-rose-400/15 text-rose-300",
  Sent: "bg-sky-400/15 text-sky-300", Accepted: "bg-emerald-400/15 text-emerald-300", Declined: "bg-rose-400/15 text-rose-300", Expired: "bg-white/10 text-white/60",
  active: "bg-emerald-400/15 text-emerald-300", suspended: "bg-rose-400/15 text-rose-300", new: "bg-sky-400/15 text-sky-300", accepted: "bg-emerald-400/15 text-emerald-300", rejected: "bg-rose-400/15 text-rose-300",
  sent: "bg-emerald-400/15 text-emerald-300", failed: "bg-rose-400/15 text-rose-300", skipped: "bg-white/10 text-white/60",
  success: "bg-emerald-400/15 text-emerald-300", refunded: "bg-white/10 text-white/70", mismatch: "bg-rose-400/15 text-rose-300",
  Requested: "bg-amber-400/15 text-amber-300", Processing: "bg-sky-400/15 text-sky-300", Rejected: "bg-rose-400/15 text-rose-300",
  unpaid: "bg-amber-400/15 text-amber-300", processing: "bg-sky-400/15 text-sky-300", paid: "bg-emerald-400/15 text-emerald-300",
  owner: "bg-emerald-400/15 text-emerald-300", manager: "bg-sky-400/15 text-sky-300", staff: "bg-white/10 text-white/70",
};
export function Badge({ children, tone }) {
  const key = tone || children;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${BADGE[key] || "bg-white/10 text-white/70"}`}>{children}</span>;
}

export function Button({ children, variant = "primary", size = "md", loading, icon: Icon, className = "", ...props }) {
  const variants = {
    primary: "bg-emerald-400 text-adm-bg hover:bg-emerald-300",
    secondary: "bg-white/8 text-white hover:bg-white/15 border border-white/10",
    danger: "bg-rose-500/90 text-white hover:bg-rose-500",
    ghost: "text-white/70 hover:text-white hover:bg-white/8",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────────────────
const fieldClass = (error) =>
  `w-full rounded-xl border bg-adm-bg px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400 ${error ? "border-rose-400/70" : "border-white/10"}`;

function Wrap({ id, label, error, hint, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-bold tracking-wide text-white/60 uppercase">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ id, label, error, hint, className, ...props }) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint} className={className}>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={fieldClass(error)} {...props} />
    </Wrap>
  );
}
export function TextArea({ id, label, error, hint, className, ...props }) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint} className={className}>
      <textarea id={id} aria-invalid={Boolean(error)} className={`${fieldClass(error)} min-h-24`} {...props} />
    </Wrap>
  );
}
export function Select({ id, label, error, hint, options, placeholder, className, ...props }) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint} className={className}>
      <select id={id} aria-invalid={Boolean(error)} className={fieldClass(error)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const { value, label: l } = typeof o === "object" ? o : { value: o, label: o };
          return (
            <option key={value} value={value}>
              {l}
            </option>
          );
        })}
      </select>
    </Wrap>
  );
}
export function Toggle({ id, label, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-white">
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-emerald-400" : "bg-white/15"}`}>
        <motion.span layout className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
      <input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${fieldClass()} pl-9`} />
    </div>
  );
}

// ── States ──────────────────────────────────────────────────────────────────────────────
export function Loading({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-white/60" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> {label}
    </div>
  );
}
export function Empty({ title = "Nothing here yet", text, action }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-white/40">
        <Inbox className="h-6 w-6" />
      </span>
      <p className="mt-4 font-bold text-white">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-white/50">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorBox({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-sm text-rose-200 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="flex-1">{error}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ── Table → cards on phones ─────────────────────────────────────────────────────────────
// columns: [{ key, label, render(row), className, hideOnCard }]
export function DataTable({ columns, rows, rowKey = (r) => r._id, onRowClick, empty }) {
  if (!rows.length) return empty || <Empty />;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/8 bg-adm-card md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs tracking-wider text-white/45 uppercase">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-bold ${c.className || ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-white/5 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-white/4" : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-white/85 ${c.className || ""}`}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
              className="rounded-2xl border border-white/8 bg-adm-card p-4"
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {columns.filter((c) => !c.hideOnCard).map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{c.label}</dt>
                    <dd className="min-w-0 text-right break-words text-white/85">{c.render ? c.render(r) : r[c.key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-between text-sm text-white/60">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
        <Button size="sm" variant="secondary" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/10 bg-adm-card sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h2 className="text-lg font-extrabold text-white">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex flex-col-reverse gap-2 border-t border-white/8 px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, text, confirmLabel = "Confirm", danger, loading, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <p className="text-sm text-white/70">{text}</p>}
      {children}
    </Modal>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────────────────
const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, tone = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-[70] flex flex-col items-end gap-2 sm:left-auto" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-bold shadow-2xl ${t.tone === "error" ? "bg-rose-500 text-white" : "bg-emerald-400 text-adm-bg"}`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// Runs an admin action with loading state + toast. Returns [run, busy].
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn, success) => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast(success);
        return r;
      } catch (e) {
        toast(e.message, "error");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return [run, busy];
}
