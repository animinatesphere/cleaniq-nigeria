// The admin menu — same groups and pages as the UK admin (~/cleaniq/src/admin/menuConfig.jsx),
// with Nigeria wording. `roles`: who sees the item (default: everyone).
import {
  BarChart3, Bot, BookOpen, Briefcase, Building2, CalendarClock, CalendarDays, ClipboardCheck, ClipboardList,
  Coins, CreditCard, EyeOff, FileSignature, FileText, Gift, HandCoins, History, Home, KanbanSquare, LayoutDashboard,
  Link2, ListChecks, ListPlus, ListTodo, Mail, MailPlus, Megaphone, MessageSquare, MessagesSquare, Network,
  Receipt, Repeat, Send, Settings, ShieldAlert, Smartphone, Tags, Ticket, Trash2, TrendingUp, UserCheck, UserPlus,
  Users, UsersRound, Wallet, Workflow,
} from "lucide-react";

const MANAGERS = ["owner", "manager"];

export const GROUPS = [
  { label: "Overview", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: MANAGERS },
    { to: "/admin/payment-links", label: "Payment link", icon: Link2 },
    { to: "/admin/expenses", label: "Expense tracker", icon: Receipt, roles: MANAGERS },
    { to: "/admin/todo", label: "To-do list", icon: ListTodo },
  ] },
  { label: "AI Receptionist", items: [
    { to: "/admin/ai", label: "AI receptionist", icon: Bot, roles: MANAGERS },
  ] },
  { label: "Operations", items: [
    { to: "/admin/jobs", label: "Job tracker", icon: UsersRound },
    { to: "/admin/company-jobs", label: "Company jobs", icon: Building2 },
    { to: "/admin/assign-jobs", label: "Assign jobs", icon: UserCheck },
    { to: "/admin/job-visibility", label: "Job visibility", icon: EyeOff },
    { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
    { to: "/admin/bookings/new", label: "New booking", icon: ListPlus, end: true },
    { to: "/admin/subscriptions", label: "Monthly plans", icon: Repeat },
    { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/admin/rota", label: "Rota", icon: CalendarClock },
    { to: "/admin/quotes/new", label: "Quote builder", icon: FileText, end: true },
    { to: "/admin/quotes", label: "Quote history", icon: History, end: true },
    { to: "/admin/leads", label: "Leads", icon: Megaphone },
    { to: "/admin/pipeline", label: "Pipeline", icon: KanbanSquare },
    { to: "/admin/campaigns", label: "Campaigns", icon: MailPlus },
    { to: "/admin/checklist", label: "Checklist", icon: ListChecks },
    { to: "/admin/invoices", label: "Invoices", icon: Receipt },
    { to: "/admin/emails", label: "Email history", icon: Mail },
    { to: "/admin/automations", label: "Automations", icon: Workflow },
    { to: "/admin/sms-automation", label: "SMS automation", icon: Smartphone },
    { to: "/admin/commercial", label: "Commercial hub", icon: Briefcase },
    { to: "/admin/property-report", label: "Property report", icon: ClipboardCheck },
    { to: "/admin/property-condition", label: "Property condition", icon: Home },
    { to: "/admin/price-list", label: "Price list", icon: Tags },
    { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  ] },
  { label: "CRM", items: [
    { to: "/admin/tasks", label: "Tasks", icon: ListTodo },
    { to: "/admin/complaints", label: "Complaints", icon: ShieldAlert },
    { to: "/admin/contracts", label: "Contracts", icon: FileSignature },
    { to: "/admin/worker-performance", label: "Cleaner performance", icon: TrendingUp },
    { to: "/admin/referrals", label: "Referrals", icon: Gift },
  ] },
  { label: "Finance", items: [
    { to: "/admin/commission", label: "Commission", icon: Coins, roles: MANAGERS },
    { to: "/admin/staff-pay", label: "Staff pay", icon: Wallet, roles: MANAGERS },
    { to: "/admin/payments", label: "Payments", icon: CreditCard, roles: MANAGERS },
    { to: "/admin/disbursements", label: "Disbursement", icon: HandCoins, roles: MANAGERS },
  ] },
  { label: "People", items: [
    { to: "/admin/staff", label: "Cleaners", icon: UsersRound },
    { to: "/admin/applicants", label: "Applicants", icon: UserPlus },
    { to: "/admin/customers", label: "Customers", icon: Users },
  ] },
  { label: "Content & Support", items: [
    { to: "/admin/blog", label: "Blog", icon: BookOpen },
    { to: "/admin/chat", label: "Chat support", icon: MessagesSquare },
    { to: "/admin/guides", label: "Send guides", icon: Send },
    { to: "/admin/cold-email", label: "Cold email", icon: MessageSquare },
  ] },
  { label: "System", items: [
    { to: "/admin/org-chart", label: "Organisation chart", icon: Network },
    { to: "/admin/bin", label: "Bin", icon: Trash2, roles: MANAGERS },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ] },
];

// Menu label for a path (used for page titles of pages still being built).
export function labelFor(pathname) {
  let best = null;
  for (const g of GROUPS) for (const i of g.items) {
    if (pathname === i.to || (!i.end && pathname.startsWith(`${i.to}/`))) {
      if (!best || i.to.length > best.to.length) best = { ...i, group: g.label };
    }
  }
  return best;
}
