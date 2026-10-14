// Placeholder for admin pages still being built in Phase 1.
import { useLocation } from "react-router";
import { Hammer } from "lucide-react";
import { Card, PageHeader } from "../ui";

export default function ComingNext() {
  const { pathname } = useLocation();
  const name = pathname.split("/").filter(Boolean).slice(1).join(" / ").replace(/-/g, " ") || "page";
  return (
    <>
      <PageHeader title={name.charAt(0).toUpperCase() + name.slice(1)} />
      <Card className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Hammer className="h-6 w-6" />
        </span>
        <div>
          <p className="font-bold text-white">Being built right now</p>
          <p className="text-sm text-white/60">This page is part of admin Phase 1 and is coming next. Its server side is already done and tested.</p>
        </div>
      </Card>
    </>
  );
}
