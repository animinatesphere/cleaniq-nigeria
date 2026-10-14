// A page from the UK admin that isn't built for Nigeria yet.
import { useLocation } from "react-router";
import { Hammer } from "lucide-react";
import { labelFor } from "../menu";
import { Card, PageHeader } from "../ui";

export default function ComingNext() {
  const { pathname } = useLocation();
  const item = labelFor(pathname);
  const title = item?.label || pathname.split("/").filter(Boolean).slice(1).join(" / ").replace(/-/g, " ") || "Page";
  return (
    <>
      <PageHeader title={title.charAt(0).toUpperCase() + title.slice(1)} subtitle={item ? `${item.group}` : undefined} />
      <Card className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Hammer className="h-6 w-6" />
        </span>
        <div>
          <p className="font-bold text-white">Being built</p>
          <p className="text-sm text-white/60">This page is coming to the Nigeria admin, matching the UK admin.</p>
        </div>
      </Card>
    </>
  );
}
