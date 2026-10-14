const mongoose = require("mongoose");

// The Bin: deleted records are copied here and can be restored by admin.
const trashItemSchema = new mongoose.Schema(
  {
    modelName: { type: String, required: true },
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: String, // what admin sees, e.g. "Booking NG-123456"
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    deletedBy: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("TrashItem", trashItemSchema);
