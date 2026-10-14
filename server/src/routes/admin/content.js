// Admin → Blog (posts, schedule, Claude drafts, autopilot) and Chat support (customer conversations).
const express = require("express");
const BlogPost = require("../../models/BlogPost");
const SupportThread = require("../../models/SupportThread");
const blog = require("../../lib/blog");
const { setSetting } = require("../../lib/settings");
const { layout } = require("../../lib/email");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { clean, escapeHtml } = require("../../lib/text");
const { badRequest, notFound } = require("../../middleware/errors");

const isHttpsUrl = (s) => /^https:\/\/[^\s]+$/i.test(String(s || ""));

function readPost(body, { partial } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has("title")) { out.title = clean(body.title, 160); if (!out.title) errors.title = "Give the post a title"; }
  if (body.excerpt !== undefined) out.excerpt = clean(body.excerpt, 400);
  if (body.body !== undefined) out.body = String(body.body || "").slice(0, 60000);
  if (body.coverImage !== undefined) { out.coverImage = String(body.coverImage || "").trim(); if (out.coverImage && !isHttpsUrl(out.coverImage)) errors.coverImage = "Use an https:// image link"; }
  if (body.tags !== undefined) out.tags = (Array.isArray(body.tags) ? body.tags : String(body.tags).split(",")).map((t) => clean(t, 30)).filter(Boolean).slice(0, 8);
  if (body.seo !== undefined) out.seo = { title: clean(body.seo?.title, 70), description: clean(body.seo?.description, 160) };
  if (body.status !== undefined) {
    if (!["draft", "scheduled", "published"].includes(body.status)) errors.status = "Choose draft, scheduled or published";
    else out.status = body.status;
  }
  if (out.status === "scheduled") {
    const at = new Date(body.publishAt);
    if (Number.isNaN(at.getTime()) || at <= new Date()) errors.publishAt = "Choose a time in the future";
    else out.publishAt = at;
  }
  return { out, errors };
}

function blogRoutes(ctx) {
  const router = express.Router();
  const managers = ctx.auth.requireAdmin("owner", "manager");
  const load = async (id) => {
    const doc = /^[a-f0-9]{24}$/i.test(id) ? await BlogPost.findById(id) : null;
    if (!doc) throw notFound("Post not found");
    return doc;
  };

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["title", "excerpt", "tags"]);
    if (["draft", "scheduled", "published"].includes(req.query.status)) filter.status = req.query.status;
    const [items, total, sums, autopilot] = await Promise.all([
      BlogPost.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).select("-body").lean(),
      BlogPost.countDocuments(filter),
      BlogPost.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      blog.autopilotSettings(),
    ]);
    res.json({ items, total, page, limit, counts: Object.fromEntries(sums.map((s) => [s._id, s.n])), autopilot, aiReady: Boolean(ctx.config.anthropicApiKey) });
  });

  router.post("/", async (req, res) => {
    const { out, errors } = readPost(req.body || {});
    if (Object.keys(errors).length) throw badRequest("Please check the post", errors);
    const post = await BlogPost.create({ ...out, slug: await blog.uniqueSlug(req.body.slug || out.title), publishedAt: out.status === "published" ? new Date() : undefined, author: req.admin.name });
    await logAdmin(req, "blog.create", post.slug, { status: post.status });
    res.status(201).json({ post });
  });

  router.post("/draft", async (req, res) => {
    const topic = clean(req.body?.topic, 300);
    if (!topic) throw badRequest("Say what the post should be about");
    const draft = await blog.draftWithAi(ctx, { topic, instructions: clean(req.body?.instructions, 1500) });
    res.json({ draft });
  });

  router.put("/autopilot", managers, async (req, res) => {
    const b = req.body || {};
    const everyDays = [1, 2, 3, 4, 7, 14].includes(Number(b.everyDays)) ? Number(b.everyDays) : 3;
    const s = { ...(await blog.autopilotSettings()), enabled: Boolean(b.enabled), everyDays, instructions: clean(b.instructions, 1500), publish: Boolean(b.publish) };
    if (s.enabled && !ctx.config.anthropicApiKey) throw badRequest("Add ANTHROPIC_API_KEY to server/.env first");
    await setSetting("blogAutopilot", s);
    await logAdmin(req, "blog.autopilot", "blog", { enabled: s.enabled, everyDays });
    res.json({ autopilot: s });
  });

  router.get("/:id", async (req, res) => res.json({ post: await load(req.params.id) }));

  router.patch("/:id", async (req, res) => {
    const post = await load(req.params.id);
    const { out, errors } = readPost(req.body || {}, { partial: true });
    if (Object.keys(errors).length) throw badRequest("Please check the post", errors);
    if (req.body.slug !== undefined && blog.slugify(req.body.slug) !== post.slug) out.slug = await blog.uniqueSlug(req.body.slug, post._id);
    if (out.status === "published" && !post.publishedAt) out.publishedAt = new Date();
    if (out.status && out.status !== "scheduled") out.publishAt = null;
    post.set(out);
    await post.save();
    await logAdmin(req, "blog.update", post.slug, Object.keys(out));
    res.json({ post });
  });

  router.delete("/:id", managers, async (req, res) => {
    const post = await load(req.params.id);
    await moveToBin(post, { label: `Blog post "${post.title}"`, deletedBy: req.admin.name });
    await logAdmin(req, "blog.delete", post.slug);
    res.json({ ok: true });
  });

  return router;
}

function supportRoutes({ auth, mailer, config }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");
  const load = async (ref) => {
    const t = await SupportThread.findOne({ ref: String(ref) });
    if (!t) throw notFound("Conversation not found");
    return t;
  };

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["ref", "name", "email", "phone", "subject", "messages.text"]);
    if (["open", "waiting", "closed"].includes(req.query.status)) filter.status = req.query.status;
    const [items, total, sums, unread] = await Promise.all([
      SupportThread.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).select({ messages: { $slice: -1 }, ref: 1, name: 1, email: 1, phone: 1, subject: 1, channel: 1, status: 1, unread: 1, lastMessageAt: 1, assignedTo: 1 }).lean(),
      SupportThread.countDocuments(filter),
      SupportThread.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      SupportThread.countDocuments({ unread: true, status: { $ne: "closed" } }),
    ]);
    res.json({ items, total, page, limit, unread, counts: Object.fromEntries(sums.map((s) => [s._id, s.n])) });
  });

  // Log a conversation that came in another way (phone call, WhatsApp, Instagram).
  router.post("/", async (req, res) => {
    const b = req.body || {};
    const text = clean(b.message, 4000);
    const name = clean(b.name, 80);
    if (!name || !text) throw badRequest("Add the customer's name and what they said", { ...(!name && { name: "Required" }), ...(!text && { message: "Required" }) });
    const t = await SupportThread.create({
      ref: `CHAT-${require("crypto").randomInt(100000, 1000000)}`, name, email: clean(b.email, 120).toLowerCase(), phone: clean(b.phone, 30),
      subject: clean(b.subject, 140), channel: ["whatsapp", "phone", "email", "instagram", "website"].includes(b.channel) ? b.channel : "phone",
      messages: [{ from: "customer", text }], unread: false, assignedTo: req.admin.name,
    });
    await logAdmin(req, "support.create", t.ref);
    res.status(201).json({ thread: t });
  });

  router.get("/:ref", async (req, res) => {
    const t = await SupportThread.findOneAndUpdate({ ref: String(req.params.ref) }, { $set: { unread: false } }, { new: true });
    if (!t) throw notFound("Conversation not found");
    res.json({ thread: t });
  });

  // Reply: saved on the conversation and emailed to the customer (when we have their email).
  router.post("/:ref/reply", async (req, res) => {
    const text = clean(req.body?.text, 4000);
    if (!text) throw badRequest("Write a reply");
    const t = await load(req.params.ref);
    const emailIt = req.body?.email !== false && t.email;
    t.messages.push({ from: "admin", text, by: req.admin.name });
    t.status = req.body?.close ? "closed" : "waiting";
    t.lastMessageAt = new Date();
    t.assignedTo = t.assignedTo || req.admin.name;
    await t.save();
    let emailed = false;
    if (emailIt) {
      const r = await mailer.send({
        to: t.email, ref: t.ref, type: "support-reply",
        subject: `Re: ${t.subject || "your message to Cleaniq"} [${t.ref}]`,
        html: layout(config, { title: "We've replied", intro: `Hi ${escapeHtml(t.name?.split(" ")[0] || "there")},`, bodyHtml: `<p style="white-space:pre-wrap">${escapeHtml(text)}</p><p style="color:#64748b;font-size:13px">Just reply to this email if you need anything else.</p>` }),
      });
      emailed = r?.status !== "failed";
    }
    await logAdmin(req, "support.reply", t.ref, { emailed });
    res.json({ thread: t, emailed });
  });

  router.post("/:ref/note", async (req, res) => {
    const text = clean(req.body?.text, 4000);
    if (!text) throw badRequest("Write what the customer said");
    const t = await load(req.params.ref);
    t.messages.push({ from: "customer", text });
    t.status = "open";
    t.lastMessageAt = new Date();
    await t.save();
    res.json({ thread: t });
  });

  router.patch("/:ref", async (req, res) => {
    const t = await load(req.params.ref);
    if (req.body?.status !== undefined) {
      if (!["open", "waiting", "closed"].includes(req.body.status)) throw badRequest("Choose a status");
      t.status = req.body.status;
    }
    if (req.body?.assignedTo !== undefined) t.assignedTo = clean(req.body.assignedTo, 80);
    await t.save();
    res.json({ thread: t });
  });

  router.delete("/:ref", managers, async (req, res) => {
    const t = await load(req.params.ref);
    await moveToBin(t, { label: `Chat ${t.ref} (${t.name})`, deletedBy: req.admin.name });
    await logAdmin(req, "support.delete", t.ref);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { blogRoutes, supportRoutes };
