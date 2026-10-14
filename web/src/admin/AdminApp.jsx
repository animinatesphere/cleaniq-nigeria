// /admin — login, then the admin pages inside the dark-green layout.
import { lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { Loading, ToastProvider } from "./ui";
import Layout from "./Layout";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";

const page = (load) => lazy(load);
const Dashboard = page(() => import("./pages/Dashboard"));
const Bookings = page(() => import("./pages/Bookings"));
const BookingDetail = page(() => import("./pages/BookingDetail"));
const NewBooking = page(() => import("./pages/NewBooking"));
const Calendar = page(() => import("./pages/Calendar"));
const Jobs = page(() => import("./pages/Jobs"));
const Customers = page(() => import("./pages/Customers"));
const CustomerProfile = page(() => import("./pages/CustomerProfile"));
const Staff = page(() => import("./pages/Staff"));
const Applicants = page(() => import("./pages/Applicants"));
const PriceList = page(() => import("./pages/PriceList"));
const ComingNext = page(() => import("./pages/ComingNext"));

function Gate() {
  const { admin } = useAuth();
  if (!admin) return <Login />;
  if (admin.mustChangePassword) return <ChangePassword forced />;
  return (
    <Suspense fallback={<div className="min-h-screen bg-adm-bg"><Loading /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="bookings/new" element={<NewBooking />} />
          <Route path="bookings/:bookingId" element={<BookingDetail />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerProfile />} />
          <Route path="staff" element={<Staff />} />
          <Route path="applicants" element={<Applicants />} />
          <Route path="price-list" element={<PriceList />} />
          <Route path="account/password" element={<ChangePassword />} />
          <Route path="*" element={<ComingNext />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function AdminApp() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
