// Cleaniq Nigeria website: shared layout + pages, with animated page transitions.
import { lazy, Suspense } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Route, Routes, useLocation } from "react-router";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import ScrollManager from "./components/ScrollManager";
import Home from "./pages/Home";
// Loaded only when someone opens them, so the home page stays fast.
const Booking = lazy(() => import("./pages/Booking"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Blog = lazy(() => import("./pages/Blog"));
const Contact = lazy(() => import("./pages/Contact"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
import NotFound from "./pages/NotFound";
import { EASE } from "./motion";

function Page({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: EASE }}>
      <Suspense fallback={<div className="min-h-screen bg-cream" />}>{children}</Suspense>
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  // The admin has its own layout (no website navbar/footer).
  if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-adm-bg" />}>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    );
  }
  return (
    <MotionConfig reducedMotion="user">
      <ScrollManager />
      <Navbar />
      <main>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Page><Home /></Page>} />
            <Route path="/booking" element={<Page><Booking /></Page>} />
            <Route path="/payment/success" element={<Page><PaymentSuccess /></Page>} />
            <Route path="/blog" element={<Page><Blog /></Page>} />
            <Route path="/contact" element={<Page><Contact /></Page>} />
            <Route path="/blog/:slug" element={<Page><BlogPost /></Page>} />
            <Route path="*" element={<Page><NotFound /></Page>} />
          
          </Routes>
        </AnimatePresence>
      </main>
      <Footer showCta={isHome} />
      <WhatsAppButton />
    </MotionConfig>
  );
}
