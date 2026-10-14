// Blog helpers: slugs, publishing scheduled posts, and Claude drafts / autopilot (needs ANTHROPIC_API_KEY).
const BlogPost = require("../models/BlogPost");
const { getSetting, setSetting } = require("./settings");

const AI_MODEL = "claude-sonnet-5-5";
const AUTOPILOT_DEFAULTS = { enabled: false, everyDays: 3, instructions: "", publish: false, lastRunAt: null };

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "post";
}

async function uniqueSlug(base, exceptId) {
  let slug = slugify(base);
  for (let i = 2; await BlogPost.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }); i++) slug = `${slugify(base)}-${i}`;
  return slug;
}

async function publishDuePosts(now = new Date()) {
  const r = await BlogPost.updateMany({ status: "scheduled", publishAt: { $lte: now } }, [{ $set: { status: "published", publishedAt: { $ifNull: ["$publishedAt", "$publishAt"] } } }]);
  return r.modifiedCount;
}

/** Asks Claude for a post. Returns { title, excerpt, body, tags }. */
async function draftWithAi({ config, fetchImpl = globalThis.fetch }, { topic, instructions = "" }) {
  if (!config.anthropicApiKey) throw Object.assign(new Error("Add ANTHROPIC_API_KEY to server/.env to use AI drafts"), { status: 400 });
  const prompt = `Write a helpful blog post for Cleaniq Nigeria, a professional home and office cleaning company in Lagos.
Audience: Lagos homeowners, tenants, landlords and offices. Use Nigerian context (Lagos areas, harmattan dust, rainy season, generators, estates) where it fits; prices in Naira only if needed.
Topic: ${topic}
${instructions ? `Extra instructions from the owner: ${instructions}\n` : ""}Return ONLY JSON: {"title": "...", "excerpt": "one or two sentences", "tags": ["..."], "body": "the post"}.
Body format: plain text, blank line between paragraphs, "## " for headings, "- " for bullet points, links as [text](url). 600–900 words. End with a short call to book a clean at Cleaniq.`;
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.anthropicApiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw Object.assign(new Error(`Claude couldn't write the draft (error ${res.status})`), { status: 502 });
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let post;
  try {
    post = JSON.parse(json);
  } catch {
    throw Object.assign(new Error("Claude's draft came back in the wrong shape — try again"), { status: 502 });
  }
  return {
    title: String(post.title || topic).slice(0, 160),
    excerpt: String(post.excerpt || "").slice(0, 400),
    body: String(post.body || ""),
    tags: Array.isArray(post.tags) ? post.tags.map(String).slice(0, 8) : [],
  };
}

async function autopilotSettings() {
  return { ...AUTOPILOT_DEFAULTS, ...((await getSetting("blogAutopilot")) || {}) };
}

/** Autopilot: every N days, Claude writes a post from the owner's instructions (draft, or published). */
async function runAutopilot(ctx, now = new Date()) {
  const s = await autopilotSettings();
  if (!s.enabled || !ctx.config.anthropicApiKey) return null;
  if (s.lastRunAt && now - new Date(s.lastRunAt) < s.everyDays * 24 * 3600 * 1000) return null;
  await setSetting("blogAutopilot", { ...s, lastRunAt: now }); // claim the run first, so a failure doesn't loop
  const recent = await BlogPost.find().sort({ createdAt: -1 }).limit(15).select("title").lean();
  const draft = await draftWithAi(ctx, {
    topic: "Choose a fresh, useful topic that isn't one of these recent posts: " + (recent.map((p) => p.title).join("; ") || "(none yet)"),
    instructions: s.instructions,
  });
  return BlogPost.create({ ...draft, slug: await uniqueSlug(draft.title), status: s.publish ? "published" : "draft", publishedAt: s.publish ? now : undefined, author: "Claude (autopilot)" });
}

module.exports = { slugify, uniqueSlug, publishDuePosts, draftWithAi, autopilotSettings, runAutopilot, AUTOPILOT_DEFAULTS };
