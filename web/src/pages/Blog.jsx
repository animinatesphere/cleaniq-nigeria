// /blog — cinematic: a full-screen opening scene (slow parallax, word-by-word title), a featured story
// that grows into view as you scroll, a moving topic reel, filterable stories and a closing call to book.
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, Clock, Star } from "lucide-react";
import { postDate, readMinutes, usePosts } from "../lib/blog";
import { EASE } from "../motion";

const MotionLink = motion.create(Link);
const cover = (p) => p.coverImage || "/images/hero-mopping.jpg";
const minutes = (p) => readMinutes(p.body || `${p.excerpt} `.repeat(40));

function Words({ text, className = "", delay = 0 }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span className="inline-block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 1, delay: delay + i * 0.08, ease: EASE }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function OpeningScene() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1.25]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -120]);
  return (
    <section ref={ref} className="relative flex h-[100svh] min-h-[620px] items-end overflow-hidden bg-ink">
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <motion.img src="/images/lagos-aerial.jpg" alt="" className="h-full w-full object-cover"
          initial={{ scale: 1.25, filter: "blur(8px)" }} animate={{ scale: 1, filter: "blur(0px)" }} transition={{ duration: 2.4, ease: EASE }} />
      </motion.div>
      {/* film grade: dark vignette, green tint, letterbox bars */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,26,19,0.85))]" />
      <div className="absolute inset-0 bg-primary/15 mix-blend-multiply" />
      <motion.div className="absolute inset-x-0 top-0 bg-ink" initial={{ height: "50%" }} animate={{ height: "0%" }} transition={{ duration: 1.4, ease: EASE }} />
      <motion.div className="absolute inset-x-0 bottom-0 bg-ink" initial={{ height: "50%" }} animate={{ height: "0%" }} transition={{ duration: 1.4, ease: EASE }} />

      <motion.div style={{ opacity: fade, y: lift }} className="relative mx-auto w-full max-w-7xl px-4 pb-20 sm:px-8 sm:pb-28">
        <motion.p initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.3em" }} transition={{ duration: 1.6, delay: 0.6, ease: EASE }}
          className="mb-6 flex items-center gap-3 text-xs font-bold text-mint uppercase sm:text-sm">
          <span className="h-px w-10 bg-mint" /> The Cleaniq Journal
        </motion.p>
        <h1 className="max-w-4xl text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-white sm:text-7xl lg:text-[5.5rem]">
          <Words text="Stories for a" delay={0.9} />
          <br />
          <Words text="cleaner Lagos." delay={1.2} className="text-mint" />
        </h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.7, ease: EASE }}
          className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
          Practical guides, seasonal tips and behind-the-scenes from the team keeping Lagos homes, short-lets and offices spotless.
        </motion.p>
        <motion.a href="#stories" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
          className="mt-10 inline-flex items-center gap-3 text-sm font-semibold text-white/70 hover:text-white">
          <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-white/30">
            <ArrowDown className="h-4 w-4" />
          </motion.span>
          Scroll to read
        </motion.a>
      </motion.div>
    </section>
  );
}

function Featured({ post }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const grow = useSpring(useTransform(scrollYProgress, [0, 1], [0.86, 1]), { stiffness: 90, damping: 24 });
  const radius = useTransform(scrollYProgress, [0, 1], [64, 32]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["-12%", "0%"]);
  return (
    <section ref={ref} className="bg-ink px-4 pt-6 pb-20 sm:px-8 sm:pb-28">
      <motion.div style={{ scale: grow, borderRadius: radius }} className="relative mx-auto max-w-7xl overflow-hidden">
        <MotionLink to={`/blog/${post.slug}`} className="group relative block aspect-[4/5] sm:aspect-[16/8]">
          <motion.img style={{ y: imgY }} src={cover(post)} alt="" className="absolute inset-0 h-[115%] w-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-extrabold text-ink"><Star className="h-3.5 w-3.5" />Featured story</span>
            <h2 className="mt-4 max-w-3xl text-3xl leading-tight font-extrabold text-white sm:text-5xl">{post.title}</h2>
            <p className="mt-3 max-w-2xl text-white/75 sm:text-lg">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
              <span>{postDate(post.publishedAt)}</span><span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{minutes(post)} min read</span>
              <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-bold text-ink transition-transform group-hover:translate-x-1">Read the story <ArrowUpRight className="h-4 w-4" /></span>
            </div>
          </div>
        </MotionLink>
      </motion.div>
    </section>
  );
}

function TopicReel({ tags }) {
  const row = [...tags, ...tags, ...tags];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-ink py-5" aria-hidden>
      <motion.div className="flex w-max gap-10 whitespace-nowrap" animate={{ x: ["0%", "-33.333%"] }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 text-2xl font-extrabold tracking-tight text-white/15 sm:text-4xl">
            {t}<span className="h-2 w-2 rounded-full bg-mint/60" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function StoryCard({ post, index }) {
  return (
    <motion.article layout initial={{ opacity: 0, y: 70, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.95 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.9, delay: (index % 3) * 0.12, ease: EASE }}>
      <Link to={`/blog/${post.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-slate-200">
          <motion.img initial={{ scale: 1.2 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }}
            src={cover(post)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          {post.tags?.[0] && <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-primary backdrop-blur">{post.tags[0]}</span>}
          <span className="absolute right-4 bottom-4 grid h-12 w-12 translate-y-4 place-items-center rounded-full bg-mint text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span>{postDate(post.publishedAt)}</span><span className="h-1 w-1 rounded-full bg-slate-300" /><span>{minutes(post)} min read</span>
        </div>
        <h3 className="mt-2 text-xl leading-snug font-extrabold text-ink transition-colors group-hover:text-primary sm:text-2xl">{post.title}</h3>
        <p className="mt-2 line-clamp-2 text-slate-600">{post.excerpt}</p>
      </Link>
    </motion.article>
  );
}

export default function Blog() {
  const posts = usePosts();
  const [tag, setTag] = useState("All");
  const tags = useMemo(() => ["All", ...new Set((posts || []).flatMap((p) => p.tags || []))], [posts]);
  const [featured, ...rest] = posts || [];
  const shown = tag === "All" ? rest : (posts || []).filter((p) => p.tags?.includes(tag));

  return (
    <>
      <title>Blog — Cleaning tips & guides for Lagos | Cleaniq Nigeria</title>
      <meta name="description" content="Cleaning tips, seasonal guides and advice for Lagos homes, short-lets and offices from the Cleaniq team." />
      <OpeningScene />
      {!posts ? (
        <div className="grid min-h-[50vh] place-items-center bg-ink"><motion.span className="h-10 w-10 rounded-full border-2 border-mint border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} /></div>
      ) : (
        <>
          {featured && <Featured post={featured} />}
          {tags.length > 2 && <TopicReel tags={tags.slice(1)} />}
          <section id="stories" className="scroll-mt-24 bg-cream px-4 py-20 sm:px-8 sm:py-28">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <motion.h2 initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }}
                  className="text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
                  Latest <span className="text-primary">stories</span>
                </motion.h2>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <button key={t} type="button" onClick={() => setTag(t)}
                      className={`relative rounded-full px-4 py-2 text-sm font-bold transition-colors ${tag === t ? "text-white" : "text-slate-600 hover:text-ink"}`}>
                      {tag === t && <motion.span layoutId="blog-tag" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                      <span className="relative">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <motion.div layout className="mt-14 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {shown.map((p, i) => <StoryCard key={p.slug} post={p} index={i} />)}
                </AnimatePresence>
              </motion.div>
              {!shown.length && <p className="mt-14 text-center text-slate-500">More stories coming soon.</p>}
            </div>
          </section>
          <ClosingScene />
        </>
      )}
    </>
  );
}

export function ClosingScene() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  return (
    <section ref={ref} className="relative overflow-hidden bg-ink px-4 py-28 text-center sm:px-8 sm:py-36">
      <motion.img style={{ y }} src="/images/happy-cleaner.jpg" alt="" className="absolute inset-0 h-[130%] w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/70 to-ink" />
      <div className="relative mx-auto max-w-3xl">
        <motion.h2 initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }}
          className="text-4xl leading-tight font-extrabold text-white sm:text-6xl">
          Rather we did the <span className="text-mint">cleaning</span>?
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }} className="mt-5 text-lg text-white/70">
          Book a trusted, vetted Cleaniq team anywhere in Lagos — online in minutes.
        </motion.p>
        <MotionLink to="/booking" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-mint px-8 py-4 text-base font-extrabold text-ink shadow-2xl shadow-mint/20">
          Book a clean <ArrowUpRight className="h-5 w-5" />
        </MotionLink>
      </div>
    </section>
  );
}
