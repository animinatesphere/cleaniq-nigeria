// Admin shell: sidebar grouped by section (slide-out on phones), top bar, page area.
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays, ClipboardList, CreditCard, FileText, History, LayoutDashboard, ListPlus, LogOut, Mail, Menu, Settings,
  Tags, Trash2, UserPlus, Users, UsersRound, Wallet, X,
} from "lucide-react";
import { useAuth } from "./auth";
import wordmark from "../assets/logo-wordmark-white-web.png";

// roles: who sees the item (default: everyone)
const GROUPS = [
  { label: "Overview", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  ] },
  { label: "Bookings", items: [
    { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
    { to: "/admin/bookings/new", label: "New booking", icon: ListPlus, end: true },
    { to: "/admin/jobs", label: "Jobs", icon: UsersRound },
  ] },
  { label: "Sales", items: [
    { to: "/admin/quotes/new", label: "Quote builder", icon: FileText, end: true },
    { to: "/admin/quotes", label: "Quote history", icon: History, end: true },
  ] },
  { label: "People", items: [
    { to: "/admin/customers", label: "Customers", icon: Users },
    { to: "/admin/staff", label: "Cleaners", icon: UsersRound },
    { to: "/admin/applicants", label: "Applicants", icon: UserPlus },
  ] },
  { label: "Money", items: [
    { to: "/admin/payments", label: "Payments", icon: CreditCard, roles: ["owner", "manager"] },
    { to: "/admin/staff-pay", label: "Staff pay", icon: Wallet, roles: ["owner", "manager"] },
  ] },
  { label: "Setup", items: [
    { to: "/admin/price-list", label: "Price list", icon: Tags },
    { to: "/admin/settings", label: "Settings", icon: Settings },
    { to: "/admin/emails", label: "Email history", icon: Mail },
    { to: "/admin/bin", label: "Bin", icon: Trash2, roles: ["owner", "manager"] },
  ] },
];

function Nav({ onNavigate }) {
  const { admin } = useAuth();
  return (
    <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.roles || i.roles.includes(admin.role));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <p className="px-3 text-[11px] font-bold tracking-[0.18em] text-white/35 uppercase">{g.label}</p>
            <ul className="mt-2 space-y-0.5">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    end={i.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? "text-adm-bg" : "text-white/70 hover:bg-white/5 hover:text-white"}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="adm-nav" className="absolute inset-0 rounded-xl bg-emerald-400" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                        <i.icon className="relative h-4 w-4" />
                        <span className="relative">{i.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserBox() {
  const { admin, logout } = useAuth();
  return (
    <div className="border-t border-white/8 p-4">
      <p className="truncate text-sm font-bold text-white">{admin.name}</p>
      <p className="truncate text-xs text-white/50">
        {admin.email} · <span className="capitalize">{admin.role}</span>
      </p>
      <button onClick={logout} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white">
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-adm-bg text-white">
      <title>Admin — Cleaniq Nigeria</title>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/8 bg-[#082419] lg:flex">
        <div className="flex h-16 items-center px-5">
          <img src={wordmark} alt="Cleaniq" className="h-10 w-auto" />
          <span className="ml-2 rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">ADMIN</span>
        </div>
        <Nav />
        <UserBox />
      </aside>

      {/* Phone top bar + drawer */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-adm-bg/95 px-4 backdrop-blur lg:hidden">
        <img src={wordmark} alt="Cleaniq" className="h-8 w-auto" />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl bg-white/8">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-72 max-w-[85vw] flex-col bg-[#082419]"
            >
              <div className="flex h-14 items-center justify-between px-4">
                <img src={wordmark} alt="Cleaniq" className="h-8 w-auto" />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-xl bg-white/8">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Nav onNavigate={() => setOpen(false)} />
              <UserBox />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="px-4 py-6 sm:px-6 sm:py-8 lg:ml-64 lg:px-10">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-7xl">
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
