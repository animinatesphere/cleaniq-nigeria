const mongoose = require("mongoose");

// Chat support: a conversation with a customer (from the website chat / contact form, or logged by admin).
const messageSchema = new mongoose.Schema({ from: { type: String, enum: ["customer", "admin"], required: true }, text: { type: String, required: true }, by: String, at: { type: Date, default: Date.now } }, { _id: false });

const supportThreadSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true }, // CHAT-123456
    name: String,
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: String,
    subject: { type: String, default: "" },
    channel: { type: String, default: "website" }, // website | whatsapp | phone | email
    status: { type: String, enum: ["open", "waiting", "closed"], default: "open", index: true },
    unread: { type: Boolean, default: true },
    assignedTo: String,
    messages: [messageSchema],
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SupportThread", supportThreadSchema);
