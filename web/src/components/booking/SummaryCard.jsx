// Live booking summary. Every amount shown comes from the server's /bookings/quote-price.
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Clock, Home, Lock, MapPin } from "lucide-react";
import { naira, longDate, time12 } from "../../lib/format";

function Row({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-3 text-sm text-slate-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

export default function SummaryCard({ form, service, frequencyLabel, price, priceLoading, priceError, suppliesChosen }) {
  const rooms = [
    form.bedrooms && `${form.bedrooms} bed`,
    form.bathrooms && `${form.bathrooms} bath`,
    form.kitchens && `${form.kitchens} kitchen`,
    form.livingRooms && `${form.livingRooms} living`,
  ].filter(Boolean).join(" · ");

  return (
    <aside aria-label="Booking summary" className="rounded-[1.75rem] bg-white p-6 shadow-[0_20px_60px_-20px_rgba(6,26,19,0.2)] ring-1 ring-slate-100 sm:p-7">
      <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Your booking</p>
      <h2 className="mt-2 text-xl font-extrabold text-ink">{service ? service.name : "Choose a service"}</h2>
      {service && form.hours && (
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {form.hours} hours · {frequencyLabel}
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {form.area && <Row icon={MapPin}>{[form.address, form.area].filter(Boolean).join(", ")}</Row>}
        {(form.propertyType || rooms) && <Row icon={Home}>{[form.propertyType, rooms].filter(Boolean).join(" · ")}</Row>}
        {form.date && <Row icon={CalendarDays}>{longDate(form.date)}</Row>}
        {form.time && <Row icon={Clock}>Arrival {time12(form.time)}</Row>}
      </ul>

      <div className="mt-6 border-t border-dashed border-slate-200 pt-5">
        {!service ? (
          <p className="text-sm text-slate-500">Pick a service to see your price.</p>
        ) : priceError ? (
          <p className="text-sm font-semibold text-rose-600">{priceError}</p>
        ) : (
          <div aria-live="polite" className={`transition-opacity ${priceLoading ? "opacity-50" : ""}`}>
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {price?.lines.map((l) => (
                  <motion.li key={l.key} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">
                      {l.label}
                      {l.qty > 1 && !l.key.startsWith("labour") ? ` × ${l.qty}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-ink">{naira(l.amount)}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
              {price?.vat?.enabled && (
                <li className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {price.vat.label} ({price.vat.rate}%)
                  </span>
                  <span className="font-semibold text-ink">{naira(price.vat.amount)}</span>
                </li>
              )}
            </ul>
            <div className="mt-5 flex items-end justify-between rounded-2xl bg-cream px-4 py-4">
              <span className="text-sm font-bold text-slate-600">Total</span>
              <motion.span key={price?.total} initial={{ scale: 1.15, color: "#6ee7b7" }} animate={{ scale: 1, color: "#061a13" }} className="text-2xl font-extrabold">
                {price ? naira(price.total) : "—"}
              </motion.span>
            </div>
            {!suppliesChosen && <p className="mt-3 text-xs text-slate-500">If we bring cleaning supplies, a small fee is added (step 3).</p>}
          </div>
        )}
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Lock className="h-3.5 w-3.5 text-primary" /> Secure payment with Paystack · Prices in naira
      </p>
    </aside>
  );
}
