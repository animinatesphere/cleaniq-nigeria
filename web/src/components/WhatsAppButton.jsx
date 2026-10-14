import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "../data";

export default function WhatsAppButton() {
  return (
    <motion.a
      href={whatsappLink()}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.8, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="group fixed right-4 bottom-4 z-50 flex items-center gap-3 sm:right-8 sm:bottom-8"
    >
      <span className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-xl transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block sm:translate-x-3 sm:opacity-0">
        Need help? Chat with us
      </span>
      <span className="relative grid h-14 w-14 place-items-center sm:h-16 sm:w-16 rounded-full bg-[#25D366] text-white shadow-2xl shadow-[#25D366]/40">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" />
        <MessageCircle className="relative h-7 w-7 sm:h-8 sm:w-8" />
      </span>
    </motion.a>
  );
}
