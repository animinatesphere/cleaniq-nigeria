import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ListPlus } from "lucide-react";
import { useLoad } from "../auth";
import { Badge, Button, DataTable, Empty, ErrorBox, Input, Loading, PageHeader, Pagination, SearchBox, Select, naira, shortDate, time12 } from "../ui";

const STATUSES = ["Pending", "Confirmed", "Assigned", "In Progress", "Completed", "Cancelled"];
const PAYMENT = ["Pending", "Paid", "Refund pending", "Refunded", "Failed"];

export default function Bookings() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const page = Number(params.get("page") || 1);
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  // Search after typing stops.
  useEffect(() => {
    const t = setTimeout(() => q !== (params.get("q") || "") && set("q", q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = new URLSearchParams(params);
  query.set("limit", "25");
  const { data, error, loading, reload } = useLoad(`/admin/bookings?${query}`);

  const columns = [
    { key: "ref", label: "Ref", render: (b) => <span className="font-bold text-white">{b.bookingId}</span> },
    { key: "customer", label: "Customer", render: (b) => `${b.customer?.firstName || ""} ${b.customer?.lastName || ""}` },
    { key: "service", label: "Service", render: (b) => `${b.service}${b.details?.duration ? ` · ${b.details.duration}h` : ""}` },
    { key: "when", label: "When", render: (b) => `${shortDate(b.schedule?.date)} ${time12(b.schedule?.time)}` },
    { key: "area", label: "Area", render: (b) => b.details?.area },
    { key: "cleaner", label: "Cleaner", render: (b) => b.assignedWorkerName || <span className="text-white/40">—</span> },
    { key: "amount", label: "Amount", render: (b) => naira(b.payment?.amount), className: "text-right" },
    { key: "payment", label: "Payment", render: (b) => <Badge>{b.payment?.status}</Badge> },
    { key: "status", label: "Status", render: (b) => <Badge>{b.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Bookings" subtitle={data ? `${data.total} bookings` : " "} actions={<Button icon={ListPlus} onClick={() => navigate("/admin/bookings/new")}>New booking</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchBox value={q} onChange={setQ} placeholder="Name, email, phone, ref, address" />
        <Select id="f-status" aria-label="Status" placeholder="All statuses" options={STATUSES} value={params.get("status") || ""} onChange={(e) => set("status", e.target.value)} className="sm:w-40" />
        <Select id="f-pay" aria-label="Payment" placeholder="Any payment" options={PAYMENT} value={params.get("paymentStatus") || ""} onChange={(e) => set("paymentStatus", e.target.value)} className="sm:w-40" />
        <Input id="f-from" type="date" aria-label="From date" value={params.get("from") || ""} onChange={(e) => set("from", e.target.value)} className="sm:w-40" />
        <Input id="f-to" type="date" aria-label="To date" value={params.get("to") || ""} onChange={(e) => set("to", e.target.value)} className="sm:w-40" />
      </div>
      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} onRowClick={(b) => navigate(`/admin/bookings/${b.bookingId}`)} empty={<Empty title="No bookings found" text="Try a different search or filter." />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={(p) => set("page", String(p))} />
        </>
      )}
    </>
  );
}
