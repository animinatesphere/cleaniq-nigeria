// Cleaniq Nigeria — landing page (starter; the real design comes next).
import { motion } from "framer-motion";

export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-dark to-primary text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-center max-w-2xl"
      >
        <p className="text-mint font-black tracking-[0.3em] uppercase text-sm">Coming soon · Nigeria</p>
        <h1 className="mt-4 text-5xl md:text-7xl font-black tracking-tight">Cleaniq Nigeria</h1>
        <p className="mt-6 text-lg md:text-xl text-white/80">Professional, trusted cleaning — Lagos, Abuja and beyond.</p>
      </motion.div>
    </main>
  );
}
