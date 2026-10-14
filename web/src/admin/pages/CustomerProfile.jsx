import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarCheck, Mail, MessageCircle, NotebookPen, Trash2, User } from "lucide-react";
import { useAuth, useLoad } from "../auth";
import { Badge, Button, Card, ConfirmModal, DataTable, ErrorBox, Input, Loading, PageHeader, StatCard, TextArea, dateTime, naira, shortDate, time12, useAction } from "../ui";

const ICONS = { account: User, booking: CalendarCheck, email: Mail, note: NotebookPen };

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { request, can } = useAuth();
  const [run, busy] = useAction();
  const { data, error, loading, reload } = useLoad(`/admin/customers/${id}`);
  const [edit, setEdit] = useState(null);
  const [tag, setTag] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (data) setEdit({ ...data.customer, phone: data.customer.phone || "" });
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const c = data.customer;
  const save = async (body, msg = "Saved") => {
    await run(() => request(`/admin/customers/${id}`, { method: "PATCH", body }), msg);
    reload();
  };

  return (
    <>
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All customers
      </Link>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`.trim() || c.email}
        subtitle={`Customer since ${shortDate(c.createdAt)}${c.lastLoginAt ? ` · last logged in ${dateTime(c.lastLoginAt)}` : ""}`}
        actions={
          <>
            {c.phone && (
              <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-bold text-white">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {can("owner", "manager") && <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Bookings" value={data.bookings.length} icon={CalendarCheck} />
        <StatCard label="Total paid" value={naira(data.spent)} />
        <StatCard label="Emails" value={data.timeline.filter((e) => e.kind === "email").length} icon={Mail} tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-extrabold text-white">Bookings</h2>
            <DataTable
              rows={data.bookings}
              onRowClick={(b) => navigate(`/admin/bookings/${b.bookingId}`)}
              columns={[
                { key: "ref", label: "Ref", render: (b) => b.bookingId },
                { key: "service", label: "Service" },
                { key: "when", label: "When", render: (b) => `${shortDate(b.schedule?.date)} ${time12(b.schedule?.time)}` },
                { key: "amount", label: "Amount", render: (b) => naira(b.payment?.amount) },
                { key: "status", label: "Status", render: (b) => <Badge>{b.status}</Badge> },
              ]}
            />
          </Card>
          <Card>
            <h2 className="mb-3 font-extrabold text-white">Timeline</h2>
            <ol className="relative space-y-4 border-l border-white/10 pl-5">
              {data.timeline.map((e, i) => {
                const Icon = ICONS[e.kind] || User;
                return (
                  <li key={i} className="relative">
                    <span className="absolute top-0.5 -left-[31px] grid h-5 w-5 place-items-center rounded-full bg-adm-raise text-emerald-300 ring-4 ring-adm-card">
                      <Icon className="h-3 w-3" />
                    </span>
                    <p className="text-sm text-white/85">{e.text}</p>
                    <p className="text-xs text-white/40">{dateTime(e.at)}{e.by ? ` · ${e.by}` : ""}</p>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        {edit && (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 font-extrabold text-white">Details</h2>
              <div className="space-y-3">
                <Input id="c-first" label="First name" value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} />
                <Input id="c-last" label="Last name" value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} />
                <Input id="c-email" label="Email" value={c.email} disabled hint="The email is the customer's login" />
                <Input id="c-phone" label="Phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                <Input id="c-area" label="Area" value={edit.area || ""} onChange={(e) => setEdit({ ...edit, area: e.target.value })} />
                <Input id="c-address" label="Address" value={edit.address || ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
                <TextArea id="c-notes" label="Notes" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                <Button loading={busy} className="w-full" onClick={() => save({ firstName: edit.firstName, lastName: edit.lastName, phone: edit.phone, area: edit.area, address: edit.address, notes: edit.notes })}>
                  Save details
                </Button>
              </div>
            </Card>
            <Card>
              <h2 className="mb-3 font-extrabold text-white">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {c.tags?.map((t) => (
                  <button key={t} onClick={() => save({ tags: c.tags.filter((x) => x !== t) }, "Tag removed")} className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-rose-400/20 hover:text-rose-200" title="Remove tag">
                    {t} ×
                  </button>
                ))}
                {!c.tags?.length && <p className="text-sm text-white/40">No tags yet.</p>}
              </div>
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { save({ tags: [...(c.tags || []), tag.trim()] }, "Tag added"); setTag(""); } }}>
                <Input id="tag" aria-label="New tag" placeholder="e.g. VIP, Lekki estate" value={tag} onChange={(e) => setTag(e.target.value)} className="flex-1" />
                <Button type="submit" variant="secondary">Add</Button>
              </form>
            </Card>
            <Card>
              <h2 className="mb-1 font-extrabold text-white">Login</h2>
              <p className="text-sm text-white/60">Customers log in with a one-time code sent to their email, so there's no password to reset or reveal. If they're stuck, ask them to use “Email me a code” on the login page.</p>
            </Card>
          </div>
        )}
      </div>
      <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)} danger title="Delete customer?" text="They move to the Bin and can be restored. Their bookings are kept." confirmLabel="Delete" loading={busy}
        onConfirm={async () => { await run(() => request(`/admin/customers/${id}`, { method: "DELETE" }), "Moved to the Bin"); navigate("/admin/customers"); }} />
    </>
  );
}
