// Admin → Quote history (like the UK QuoteHistory): every quote, by status, with resend / decline / delete.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { FilePlus2, Mail, Trash2, XCircle } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, ConfirmModal, DataTable, Empty, ErrorBox, Loading, Modal, PageHeader, Pagination, SearchBox, StatCard, dateTime, naira, shortDate, time12, useAction } from "../ui";

const TABS = ["All", "Sent", "Accepted", "Declined", "Expired"];

export default function QuoteHistory() {
  const { request, can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [run, busy] = useAction();
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = tab === "All" ? "" : tab;
  const { data, error, loading, reload } = useLoad(`/admin/quotes?page=${page}&limit=25${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);

  // Opened straight after the quote builder saved one.
  useEffect(() => {
    const ref = params.get("open");
    if (!ref) return;
    request(`/admin/quotes/${encodeURIComponent(ref)}`).then((r) => setView(r.quote)).catch(() => {});
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (path, success) => {
    const r = await run(() => request(`/admin/quotes/${view.quoteRef}/${path}`, { method: "POST" }), success);
    if (r?.quote) setView(r.quote);
    reload();
  };
  const remove = async () => {
    await run(() => request(`/admin/quotes/${view.quoteRef}`, { method: "DELETE" }), "Quote moved to the Bin");
    setConfirmDelete(false);
    setView(null);
    reload();
  };

  const counts = data?.counts || {};
  const columns = [
    { key: "ref", label: "Quote", render: (x) => <span className="font-bold text-white">{x.quoteRef}</span> },
    { key: "customer", label: "Customer", render: (x) => `${x.customer?.firstName || ""} ${x.customer?.lastName || ""}` },
    { key: "total", label: "Total", render: (x) => <span className="font-bold">{naira(x.grandTotal)}</span> },
    { key: "date", label: "Clean date", render: (x) => (x.serviceDate ? shortDate(x.serviceDate) : "—") },
    { key: "sent", label: "Sent", render: (x) => dateTime(x.createdAt) },
    { key: "valid", label: "Valid until", render: (x) => shortDate(x.validUntil) },
    { key: "status", label: "Status", render: (x) => <Badge>{x.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Quote history" subtitle="Every quote sent from the builder and the website."
        actions={<Button icon={FilePlus2} onClick={() => navigate("/admin/quotes/new")}>New quote</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {["Sent", "Accepted", "Declined", "Expired"].map((s) => (
          <StatCard key={s} label={s} value={counts[s]?.count || 0} hint={naira(counts[s]?.value || 0)} onClick={() => { setTab(s); setPage(1); }}
            tone={{ Sent: "sky", Accepted: "emerald", Declined: "rose", Expired: "amber" }[s]} />
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setPage(1); }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${tab === t ? "bg-emerald-400 text-adm-bg" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>
              {t}
            </button>
          ))}
        </div>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email, ref, area…" />
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(x) => x.quoteRef} onRowClick={async (x) => setView((await request(`/admin/quotes/${x.quoteRef}`)).quote)}
            empty={<Empty title="No quotes yet" text="Quotes you build, and quote requests from the website, show up here." action={<Button icon={FilePlus2} onClick={() => navigate("/admin/quotes/new")}>Build a quote</Button>} />} />
          <Pagination page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}

      <Modal open={Boolean(view)} onClose={() => setView(null)} wide title={view ? `Quote ${view.quoteRef}` : ""}
        footer={view && (
          <>
            {can("owner", "manager") && <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>}
            {["Sent", "Expired"].includes(view.status) && <Button variant="secondary" icon={XCircle} loading={busy} onClick={() => act("decline", "Marked as declined")}>Mark declined</Button>}
            {["Sent", "Expired"].includes(view.status) && <Button icon={Mail} loading={busy} onClick={() => act("resend", "Quote emailed again (valid for another 30 days)")}>Resend</Button>}
          </>
        )}>
        {view && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{view.status}</Badge>
              <span className="text-white/60">Sent {view.sentCount || 1}× · last {dateTime(view.lastSentAt || view.createdAt)} · valid until {shortDate(view.validUntil)}</span>
              {view.bookingId && <button type="button" className="font-bold text-emerald-300 underline" onClick={() => navigate(`/admin/bookings/${view.bookingId}`)}>Booking {view.bookingId}</button>}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[["Customer", `${view.customer?.firstName || ""} ${view.customer?.lastName || ""}`], ["Email", view.customer?.email], ["Phone", view.customer?.phone],
                ["Area", view.details?.area], ["Address", view.details?.address], ["Property", [view.details?.propertyType, view.details?.rooms?.bedrooms != null && `${view.details.rooms.bedrooms} bed`].filter(Boolean).join(" · ")],
                ["Preferred date", view.serviceDate ? `${shortDate(view.serviceDate)}${view.serviceTime ? ` · ${time12(view.serviceTime)}` : ""}` : ""], ["Created by", view.createdBy || (view.source === "website" ? "Website" : "")]]
                .filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt className="text-xs font-bold tracking-wide text-white/40 uppercase">{k}</dt><dd className="mt-0.5 text-white/85">{v}</dd></div>
                ))}
            </dl>
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <dl className="space-y-2">
                {view.items.map((it, i) => (
                  <div key={i}>
                    <div className="flex justify-between gap-3">
                      <dt className="text-white/80">{it.service}{it.size ? ` — ${it.size}` : ""}{it.option ? ` (${it.option})` : ""}{it.qty > 1 ? ` × ${it.qty}` : ""}</dt>
                      <dd className="font-bold text-white">{naira(it.subtotal)}</dd>
                    </div>
                    {it.extras?.length > 0 && <p className="text-xs text-white/50">+ {it.extras.map((x) => `${x.name}${x.qty > 1 ? ` × ${x.qty}` : ""}`).join(", ")}</p>}
                  </div>
                ))}
                {view.discount?.amount > 0 && <div className="flex justify-between text-emerald-300"><dt>{view.discount.label}</dt><dd>−{naira(view.discount.amount)}</dd></div>}
                {view.vat?.enabled && <div className="flex justify-between text-white/60"><dt>{view.vat.label} ({view.vat.rate}%)</dt><dd>{naira(view.vat.amount)}</dd></div>}
                <div className="flex justify-between border-t border-white/10 pt-2 text-base"><dt className="font-bold text-white">Total</dt><dd className="font-black text-emerald-300">{naira(view.grandTotal)}</dd></div>
              </dl>
            </div>
            {view.details?.notes && <p className="whitespace-pre-wrap text-white/70">{view.details.notes}</p>}
          </div>
        )}
      </Modal>

      <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} danger loading={busy}
        title="Delete this quote?" text="It moves to the Bin and can be restored from there." confirmLabel="Delete" />
    </>
  );
}
