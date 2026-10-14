// /admin — login, then the admin pages inside the dark-green layout.
import { lazy, Suspense } from "react";
import { Briefcase, ClipboardCheck, ClipboardList, Coins, FileSignature, Gift, Home, ListChecks, ListTodo, MailPlus, MessageSquare, Send, ShieldAlert, Ticket } from "lucide-react";
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
const QuoteBuilder = page(() => import("./pages/QuoteBuilder"));
const QuoteHistory = page(() => import("./pages/QuoteHistory"));
const Payments = page(() => import("./pages/Payments"));
const StaffPay = page(() => import("./pages/StaffPay"));
const Settings = page(() => import("./pages/Settings"));
const EmailHistory = page(() => import("./pages/EmailHistory"));
const Bin = page(() => import("./pages/Bin"));
const ComingNext = page(() => import("./pages/ComingNext"));
const named = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const Invoices = page(() => import("./pages/Invoices"));
const Subscriptions = page(() => import("./pages/Subscriptions"));
const Leads = page(() => import("./pages/Leads"));
const Expenses = page(() => import("./pages/Expenses"));
const Analytics = page(() => import("./pages/Analytics"));
const WorkerPerformance = page(() => import("./pages/WorkerPerformance"));
const Disbursements = page(() => import("./pages/Disbursements"));
const Rota = page(() => import("./pages/Rota"));
const Blog = page(() => import("./pages/Blog"));
const ChatSupport = page(() => import("./pages/ChatSupport"));
const CollectionPage = page(() => import("./pages/CollectionPage"));
const AssignJobs = named(() => import("./pages/JobBoards"), "AssignJobs");
const JobVisibility = named(() => import("./pages/JobBoards"), "JobVisibility");
const CompanyJobs = named(() => import("./pages/JobBoards"), "CompanyJobs");
const Automations = named(() => import("./pages/AutomationPages"), "Automations");
const SmsAutomation = named(() => import("./pages/AutomationPages"), "SmsAutomation");
const AiReceptionist = named(() => import("./pages/AutomationPages"), "AiReceptionist");

// Simple list pages, all drawn by CollectionPage from the server's description of each type.
const COLLECTIONS = [
  ["todo", "todo", "Your own list of things to get done.", ListTodo],
  ["tasks", "task", "Jobs for the team — who's doing what, and by when.", ClipboardList],
  ["complaints", "complaint", "Every complaint, what happened and how we put it right.", ShieldAlert],
  ["contracts", "contract", "Agreements with offices, estates and regular clients.", FileSignature],
  ["checklist", "checklist", "What cleaners must do on each type of clean.", ListChecks],
  ["coupons", "coupon", "Discount codes customers can use.", Ticket],
  ["referrals", "referral", "Customers who brought a friend — and their reward.", Gift],
  ["commission", "creator", "Influencers and creators with their own code, paid a % when a booking is done and paid.", Coins],
  ["commercial", "commercial", "Offices, estates, hotels and other business clients.", Briefcase],
  ["property-report", "propertyReport", "Room-by-room checks after a clean.", ClipboardCheck],
  ["property-condition", "propertyCondition", "Condition before and after — protects you if something was already damaged.", Home],
  ["guides", "guide", "Send a guide or PDF to customers, cleaners or leads.", Send],
  ["campaigns", "campaign", "Email offers and news to customers and leads.", MailPlus],
  ["cold-email", "coldEmail", "Introduce Cleaniq to businesses that don't know you yet.", MessageSquare],
];

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
          <Route path="quotes/new" element={<QuoteBuilder />} />
          <Route path="quotes" element={<QuoteHistory />} />
          <Route path="payments" element={<Payments />} />
          <Route path="staff-pay" element={<StaffPay />} />
          <Route path="settings" element={<Settings />} />
          <Route path="emails" element={<EmailHistory />} />
          <Route path="bin" element={<Bin />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="payment-links" element={<Invoices mode="links" />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="leads" element={<Leads />} />
          <Route path="pipeline" element={<Leads board />} />
          <Route path="worker-performance" element={<WorkerPerformance />} />
          <Route path="disbursements" element={<Disbursements />} />
          <Route path="rota" element={<Rota />} />
          <Route path="assign-jobs" element={<AssignJobs />} />
          <Route path="job-visibility" element={<JobVisibility />} />
          <Route path="company-jobs" element={<CompanyJobs />} />
          <Route path="automations" element={<Automations />} />
          <Route path="sms-automation" element={<SmsAutomation />} />
          <Route path="ai" element={<AiReceptionist />} />
          <Route path="blog" element={<Blog />} />
          <Route path="chat" element={<ChatSupport />} />
          <Route path="org-chart" element={<CollectionPage key="org" type="orgMember" view="org" subtitle="Who's who in Cleaniq Nigeria, and who reports to whom." />} />
          {COLLECTIONS.map(([path, type, subtitle, icon]) => (
            <Route key={path} path={path} element={<CollectionPage key={type} type={type} subtitle={subtitle} icon={icon} />} />
          ))}
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
