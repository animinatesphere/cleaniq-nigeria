import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useLoad } from "../auth";
import { Badge, DataTable, Empty, ErrorBox, Loading, PageHeader, Pagination, SearchBox, naira, shortDate } from "../ui";

export default function Customers() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useLoad(`/admin/customers?q=${encodeURIComponent(search)}&page=${page}`);

  const columns = [
    { key: "name", label: "Name", render: (c) => <span className="font-bold text-white">{`${c.firstName} ${c.lastName}`.trim() || "—"}</span> },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "area", label: "Area" },
    { key: "bookings", label: "Bookings", className: "text-right" },
    { key: "spent", label: "Spent", render: (c) => naira(c.spent), className: "text-right" },
    { key: "last", label: "Last booking", render: (c) => shortDate(c.lastBooking) },
    { key: "tags", label: "Tags", render: (c) => <div className="flex flex-wrap justify-end gap-1 md:justify-start">{c.tags?.map((t) => <Badge key={t}>{t}</Badge>)}</div> },
  ];

  return (
    <>
      <PageHeader title="Customers" subtitle={data ? `${data.total} customers` : " "} />
      <div className="mb-5">
        <SearchBox value={q} onChange={setQ} placeholder="Name, email, phone, area" />
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} onRowClick={(c) => navigate(`/admin/customers/${c._id}`)} empty={<Empty title="No customers found" text="Customers appear here after they book or get a quote." />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
    </>
  );
}
