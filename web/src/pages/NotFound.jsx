import { Link } from "react-router";

export default function NotFound() {
  return (
    <section className="grid min-h-[70vh] place-items-center bg-cream px-4 pt-24 pb-16 text-center">
      <title>Page not found — Cleaniq Nigeria</title>
      <div>
        <p className="text-sm font-bold tracking-[0.2em] text-primary uppercase">404</p>
        <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-5xl">We couldn't find that page</h1>
        <p className="mt-4 text-slate-600">It may have moved. Let's get you somewhere useful.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="rounded-full bg-primary px-8 py-4 font-bold text-white">Go to the home page</Link>
          <Link to="/booking" className="rounded-full border-2 border-ink/10 bg-white px-8 py-4 font-bold text-ink">Book a clean</Link>
        </div>
      </div>
    </section>
  );
}
