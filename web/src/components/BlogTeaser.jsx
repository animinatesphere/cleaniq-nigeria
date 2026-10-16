// Home page: the three latest stories from the blog.
import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./ui";
import { postDate, usePosts } from "../lib/blog";
import { EASE } from "../motion";

export default function BlogTeaser() {
  const posts = usePosts();
  if (!posts?.length) return null;
  return (
    <section id="blog" className="bg-cream px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="From the blog" title="Cleaning tips for Lagos living" text="Seasonal guides, checklists and advice from our cleaning team." />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {posts.slice(0, 3).map((p, i) => (
            <motion.article key={p.slug} initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }}>
              <Link to={`/blog/${p.slug}`} className="group block h-full overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_-20px_rgba(6,26,19,0.18)] ring-1 ring-slate-100">
                <div className="aspect-[16/10] overflow-hidden"><img src={p.coverImage || "/images/hero-mopping.jpg"} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" /></div>
                <div className="p-6">
                  <p className="text-xs font-semibold text-slate-500">{postDate(p.publishedAt)}</p>
                  <h3 className="mt-2 text-xl leading-snug font-extrabold text-ink group-hover:text-primary">{p.title}</h3>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">Read story <ArrowUpRight className="h-4 w-4" /></span>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to="/blog" className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 font-bold text-white transition hover:bg-primary">See all stories <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}
