// /blog/:slug — one story: full-screen parallax cover, reading-progress bar, large first letter,
// share buttons, related stories and the closing call to book.
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Check, Clock, Link2, MessageCircle } from "lucide-react";
import PostBody from "../components/PostBody";
import { postDate, readMinutes, usePost, usePosts } from "../lib/blog";
import { ClosingScene } from "./Blog";
import { EASE } from "../motion";

export default function BlogPost() {
  const { slug } = useParams();
  const { post, loading } = usePost(slug);
  const posts = usePosts();
  const hero = useRef(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.2]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const { scrollYProgress: page } = useScroll();
  const progress = useSpring(page, { stiffness: 120, damping: 30 });
  const [copied, setCopied] = useState(false);

  if (loading) return <div className="grid min-h-screen place-items-center bg-ink"><motion.span className="h-10 w-10 rounded-full border-2 border-mint border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} /></div>;
  if (!post) {
    return (
      <section className="grid min-h-[70vh] place-items-center bg-cream px-4 pt-24 text-center">
        <div><h1 className="text-3xl font-extrabold text-ink">We couldn't find that story</h1><Link to="/blog" className="mt-6 inline-flex items-center gap-2 font-bold text-primary"><ArrowLeft className="h-4 w-4" />Back to the blog</Link></div>
      </section>
    );
  }

  const url = typeof window !== "undefined" ? window.location.href : "";
  const related = (posts || []).filter((p) => p.slug !== post.slug).sort((a, b) => Number(b.tags?.some((t) => post.tags?.includes(t))) - Number(a.tags?.some((t) => post.tags?.includes(t)))).slice(0, 3);
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  const first = (post.body || "").trimStart();
  const dropCap = /^[A-Za-z]/.test(first) && !first.startsWith("## ");

  return (
    <>
      <title>{`${post.seo?.title || post.title} | Cleaniq Nigeria`}</title>
      <meta name="description" content={post.seo?.description || post.excerpt} />
      <motion.div style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-[60] h-1 origin-left bg-mint" />

      <section ref={hero} className="relative flex h-[88svh] min-h-[560px] items-end overflow-hidden bg-ink">
        <motion.img style={{ y: imgY, scale: imgScale }} src={post.coverImage || "/images/hero-mopping.jpg"} alt="" className="absolute inset-0 h-full w-full object-cover"
          initial={{ filter: "blur(10px) brightness(0.6)" }} animate={{ filter: "blur(0px) brightness(1)" }} transition={{ duration: 1.8, ease: EASE }} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(6,26,19,0.8))]" />
        <motion.div style={{ y: textY, opacity: fade }} className="relative mx-auto w-full max-w-4xl px-4 pb-16 sm:px-8 sm:pb-24">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" />All stories</Link>
          </motion.div>
          {post.tags?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 flex flex-wrap gap-2">
              {post.tags.map((t) => <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-mint ring-1 ring-white/15 backdrop-blur">{t}</span>)}
            </motion.div>
          )}
          <motion.h1 initial={{ opacity: 0, y: 50, clipPath: "inset(0 0 100% 0)" }} animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
            className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
            {post.title}
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65">
            <span className="font-semibold text-white/85">{post.author || "Cleaniq Team"}</span>
            <span>{postDate(post.publishedAt)}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{readMinutes(post.body)} min read</span>
          </motion.div>
        </motion.div>
      </section>

      <article className="relative bg-white px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_minmax(0,44rem)_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-32 flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase [writing-mode:vertical-rl]">Share</span>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" className="grid h-11 w-11 place-items-center rounded-full bg-cream text-primary transition hover:bg-primary hover:text-white"><MessageCircle className="h-5 w-5" /></a>
              <button type="button" onClick={copy} aria-label="Copy link" className="grid h-11 w-11 place-items-center rounded-full bg-cream text-primary transition hover:bg-primary hover:text-white">{copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}</button>
            </div>
          </aside>
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }}>
            {post.excerpt && <p className="mb-10 border-l-4 border-mint pl-5 text-xl leading-relaxed font-semibold text-ink sm:text-2xl">{post.excerpt}</p>}
            <div className={dropCap ? "[&>div>p:first-child]:first-letter:float-left [&>div>p:first-child]:first-letter:mt-1 [&>div>p:first-child]:first-letter:mr-3 [&>div>p:first-child]:first-letter:text-7xl [&>div>p:first-child]:first-letter:font-extrabold [&>div>p:first-child]:first-letter:leading-[0.8] [&>div>p:first-child]:first-letter:text-primary" : ""}>
              <PostBody body={post.body} />
            </div>
            <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-8 lg:hidden">
              <span className="text-sm font-bold text-slate-500">Share:</span>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-bold text-primary"><MessageCircle className="h-4 w-4" />WhatsApp</a>
              <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-bold text-primary">{copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{copied ? "Copied" : "Copy link"}</button>
            </div>
          </motion.div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-cream px-4 py-20 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Keep reading</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {related.map((p, i) => (
                <motion.div key={p.slug} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}>
                  <Link to={`/blog/${p.slug}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden rounded-[1.5rem]"><img src={p.coverImage || "/images/hero-mopping.jpg"} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" /></div>
                    <h3 className="mt-4 text-lg leading-snug font-extrabold text-ink group-hover:text-primary">{p.title}</h3>
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">Read <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      <ClosingScene />
    </>
  );
}
