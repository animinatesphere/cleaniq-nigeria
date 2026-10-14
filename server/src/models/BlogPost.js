const mongoose = require("mongoose");

// Website blog posts (admin → Blog). Published posts show on the website; a scheduled post goes live at publishAt.
const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: "", maxlength: 400 },
    body: { type: String, default: "" }, // Markdown-style plain text: blank line = new paragraph, "## " = heading, [text](url) = link
    coverImage: { type: String, default: "" }, // https URL
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "scheduled", "published"], default: "draft", index: true },
    publishAt: Date,
    publishedAt: Date,
    seo: { title: String, description: String },
    author: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("BlogPost", blogPostSchema);
