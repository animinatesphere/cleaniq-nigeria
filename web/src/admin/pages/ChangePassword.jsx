// Shown when an admin logs in with a temporary password (or chooses to change it).
import { useState } from "react";
import { useAuth } from "../auth";
import { Button, Card, Input, PageHeader, useToast } from "../ui";

export default function ChangePassword({ forced }) {
  const { request, admin, setAdmin } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (form.newPassword.length < 10) errs.newPassword = "At least 10 characters";
    if (form.newPassword !== form.confirm) errs.confirm = "Passwords don't match";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await request("/auth/admin/change-password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setAdmin({ ...admin, mustChangePassword: false });
      toast("Password changed");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setErrors({ currentPassword: err.message });
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className={forced ? "grid min-h-screen place-items-center bg-adm-bg px-4" : ""}>
      <div className="w-full max-w-md">
        <PageHeader title="Choose a new password" subtitle={forced ? "You logged in with a temporary password. Please choose your own before continuing." : undefined} />
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Input id="cur" type="password" label={forced ? "Temporary password" : "Current password"} autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} />
            <Input id="new" type="password" label="New password" autoComplete="new-password" hint="At least 10 characters" value={form.newPassword} onChange={set("newPassword")} error={errors.newPassword} />
            <Input id="confirm" type="password" label="Repeat new password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} />
            <Button type="submit" loading={busy} className="w-full">
              Save password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
