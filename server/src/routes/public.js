// Public (website) routes: invoice payment check, blog posts, and the contact / chat form.
const express = require("express");
const crypto = require("crypto");
const Invoice = require("../models/Invoice");
const BlogPost = require("../models/BlogPost");
const SupportThread = require("../models/SupportThread");
const Lead = require("../models/Lead");
const { confirmInvoicePayment } = require("../lib/invoices");
const { paging } = require("../lib/query");
const { clean, isEmail, normaliseEmail } = require("../lib/text");
const { badRequest, notFound } = require("../middleware/errors");

module.exports = function publicRoutes({ limiters, paystack, mailer, config }) {
  const router = express.Router();

  // After Paystack sends the customer back from an invoice / payment link.
  router.get("/invoices/:no/status", limiters.publicForm, async (req, res) => {
    const reference = String(req.query.reference || "");
    let inv = await Invoice.findOne({ invoiceNo: String(req.params.no) });
    if (!inv || !reference || inv.paystack?.reference !== reference) throw notFound("Invoice not found");
    if (inv.status === "Unpaid") {
      try {
        const tx = await paystack.verify(reference);
        if (tx?.status === "success") { await confirmInvoicePayment(tx); inv = await Invoice.findById(inv._id); }
      } catch {
        // Paystack unreachable — the webhook will still confirm it.
      }
    }
    res.json({ invoiceNo: inv.invoiceNo, status: inv.status, total: inv.total, kind: inv.kind, paidAt: inv.paidAt });
  });

  router.get("/blog", async (req, res) => {
    const { page, limit, skip } = paging({ ...req.query, limit: Math.min(Number(req.query.limit) || 12, 24) });
    const filter = { status: "published" };
    const [items, total] = await Promise.all([
      BlogPost.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).select("title slug excerpt coverImage tags publishedAt author").lean(),
      BlogPost.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  });
  router.get("/blog/:slug", async (req, res) => {
    const post = await BlogPost.findOne({ slug: String(req.params.slug).toLowerCase(), status: "published" }).lean();
    if (!post) throw notFound("Post not found");
    res.json({ post });
  });

  // Website chat / contact form → Chat support (+ a lead).
  router.post("/support", limiters.publicForm, async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.status(201).json({ ok: true }); // honeypot
    const name = clean(b.name, 80);
    const email = normaliseEmail(b.email);
    const message = clean(b.message, 4000);
    const errors = {};
    if (!name) errors.name = "Enter your name";
    if (!isEmail(email)) errors.email = "Enter a valid email";
    if (!message) errors.message = "Write your message";
    if (Object.keys(errors).length) throw badRequest("Please check the form", errors);
    const phone = clean(b.phone, 30);
    const open = await SupportThread.findOne({ email, status: { $ne: "closed" } }).sort({ lastMessageAt: -1 });
    const thread = open || new SupportThread({ ref: `CHAT-${crypto.randomInt(100000, 1000000)}`, name, email, phone, subject: clean(b.subject, 140) || message.slice(0, 60), channel: "website" });
    thread.messages.push({ from: "customer", text: message });
    thread.status = "open";
    thread.unread = true;
    thread.lastMessageAt = new Date();
    await thread.save();
    if (!open) await Lead.create({ name, email, phone, source: "contact", message: message.slice(0, 2000), ref: thread.ref }).catch(() => {});
    if (config.teamEmail) await mailer.send({ to: config.teamEmail, ref: thread.ref, type: "support-new", subject: `New message from ${name} [${thread.ref}]`, html: `<p>${name} (${email}) wrote:</p><p style="white-space:pre-wrap">${require("../lib/text").escapeHtml(message)}</p>` });
    res.status(201).json({ ok: true, ref: thread.ref });
  });

  return router;
};
