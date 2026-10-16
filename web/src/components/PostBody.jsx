// Renders a blog post body (blank line = paragraph, "## " = heading, "- " = bullet, [text](url) = link,
// **bold**). Built as React elements — never raw HTML — so a post can't inject scripts.
import { Fragment } from "react";
import { Link } from "react-router";

function inline(text, key) {
  const out = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const href = m[2];
      if (href.startsWith("/")) out.push(<Link key={`${key}-${m.index}`} to={href} className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{m[1]}</Link>);
      else if (/^https?:\/\//i.test(href)) out.push(<a key={`${key}-${m.index}`} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{m[1]}</a>);
      else out.push(m[1]);
    } else out.push(<strong key={`${key}-${m.index}`} className="font-bold text-ink">{m[3]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function PostBody({ body = "" }) {
  const blocks = String(body).replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-6 text-[1.075rem] leading-[1.85] text-slate-700">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="!mt-12 text-2xl font-extrabold tracking-tight text-ink sm:text-[1.7rem]">{inline(b.slice(3), i)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*-\s+/.test(l))) {
          return (
            <ul key={i} className="space-y-3">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-[0.7em] h-2 w-2 shrink-0 rounded-full bg-mint ring-4 ring-mint/25" />
                  <span>{inline(l.replace(/^\s*-\s+/, ""), `${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}
