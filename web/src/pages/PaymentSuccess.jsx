// /payment/success — where Paystack sends people after paying. We don't trust the redirect itself:
// we ask the server, which confirms with Paystack, and show the result.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { Check, Clock, Loader2 } from "lucide-react";
import { MOCK, api } from "../lib/api";
import { longDate, naira, time12 } from "../lib/format";
import { EASE } from "../motion";

const CHECKS = 8; // ~24 seconds of checking
const DRAFT_KEY = "cleaniq-ng-booking-v1";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking") || "";
  const invoiceNo = params.get("invoice") || ""; // invoices / payment links / monthly plans
  const reference = params.get("reference") || params.get("trxref") || "";
  const [status, setStatus] = useState(null);
  const [state, setState] = useState((bookingId || invoiceNo) && reference ? "checking" : "missing"); // checking | paid | pending | missing | error

  useEffect(() => {
    if ((!bookingId && !invoiceNo) || !reference) return;
    let alive = true;
    let tries = 0;
    let timer;
    const check = async () => {
      tries++;
      try {
        const s = invoiceNo
          ? await api(`/invoices/${encodeURIComponent(invoiceNo)}/status?reference=${encodeURIComponent(reference)}`)
          : await api(`/bookings/${encodeURIComponent(bookingId)}/status?reference=${encodeURIComponent(reference)}`);
        if (!alive) return;
        setStatus(s);
        if (s.paymentStatus === "Paid" || s.status === "Paid") {
          setState("paid");
          try {
            localStorage.removeItem(DRAFT_KEY);
            localStorage.removeItem(`${DRAFT_KEY}-pending`);
          } catch {
            /* ignore */
          }
          return;
        }
        if (tries >= CHECKS) return setState("pending");
      } catch (e) {
        if (!alive) return;
        if (e.status === 404) return setState("missing");
        if (tries >= CHECKS) return setState("error");
      }
      timer = setTimeout(check, 3000);
    };
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [bookingId, invoiceNo, reference]);

  return (
    <section className="grid min-h-screen place-items-center bg-cream px-4 pt-24 pb-16">
      <title>{state === "paid" ? "Payment successful" : "Checking your payment"} — Cleaniq Nigeria</title>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_60px_-20px_rgba(6,26,19,0.25)] sm:p-10"
      >
        {state === "checking" && (
          <div aria-live="polite">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="mt-6 text-2xl font-extrabold text-ink">Confirming your payment…</h1>
            <p className="mt-3 text-slate-600">This only takes a few seconds. Please don't close this page.</p>
          </div>
        )}

        {state === "paid" && (
          <div aria-live="polite">
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-white shadow-xl shadow-primary/30"
            >
              <Check className="h-10 w-10" strokeWidth={3} />
            </motion.span>
            <h1 className="mt-6 text-3xl font-extrabold text-ink">Payment successful</h1>
            <p className="mt-3 text-slate-600">{invoiceNo ? "Thank you — your payment has been received." : "Your clean is booked. We've emailed your confirmation."}</p>
            {invoiceNo ? (
              <div className="mt-7 rounded-2xl bg-cream p-5 text-left">
                <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Invoice</p>
                <p className="mt-1 text-2xl font-extrabold tracking-wide text-ink">{status.invoiceNo}</p>
                <div className="mt-4 flex justify-between gap-4 text-sm"><span className="text-slate-500">Paid</span><span className="font-semibold text-ink">{naira(status.total)}</span></div>
              </div>
            ) : (
            <div className="mt-7 rounded-2xl bg-cream p-5 text-left">
              <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Booking reference</p>
              <p className="mt-1 text-2xl font-extrabold tracking-wide text-ink">{status.bookingId}</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Service</dt><dd className="text-right font-semibold text-ink">{status.service}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Date</dt><dd className="text-right font-semibold text-ink">{longDate(status.date)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Arrival</dt><dd className="text-right font-semibold text-ink">{time12(status.time)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Paid</dt><dd className="text-right font-semibold text-ink">{naira(status.total)}</dd></div>
              </dl>
            </div>
            )}
            {MOCK && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Demo mode — this is a test booking. No payment was taken.</p>}
            <p className="mt-5 text-sm text-slate-500">Quote your reference if you need to contact us.</p>
          </div>
        )}

        {(state === "pending" || state === "error") && (
          <div aria-live="polite">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600">
              <Clock className="h-8 w-8" />
            </span>
            <h1 className="mt-6 text-2xl font-extrabold text-ink">We're still waiting for Paystack</h1>
            <p className="mt-3 text-slate-600">
              If you completed the payment, you'll get a confirmation email shortly{status?.bookingId ? ` for booking ${status.bookingId}` : ""}. If you cancelled, your booking is
              saved — you can try again.
            </p>
            <button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-primary px-6 py-3 font-bold text-white">
              Check again
            </button>
          </div>
        )}

        {state === "missing" && (
          <div>
            <h1 className="text-2xl font-extrabold text-ink">We couldn't find that payment</h1>
            <p className="mt-3 text-slate-600">The link looks incomplete. If you've paid, check your email for your confirmation, or message us on WhatsApp.</p>
          </div>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="rounded-full border-2 border-ink/10 px-6 py-3 font-bold text-ink hover:border-primary hover:text-primary">
            Back to home
          </Link>
          {state !== "paid" && (
            <Link to="/booking" className="rounded-full bg-ink px-6 py-3 font-bold text-white">
              Back to booking
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  );
}
