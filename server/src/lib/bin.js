// The Bin: "deleting" copies the record into TrashItem and removes it; admin can restore it later.
const mongoose = require("mongoose");
const TrashItem = require("../models/TrashItem");

async function moveToBin(doc, { label, deletedBy } = {}) {
  const modelName = doc.constructor.modelName;
  const item = await TrashItem.create({
    modelName,
    originalId: doc._id,
    label: label || `${modelName} ${doc._id}`,
    data: doc.toObject({ depopulate: true }),
    deletedBy,
  });
  await doc.deleteOne();
  return item;
}

async function restoreFromBin(trashId) {
  const item = await TrashItem.findById(trashId);
  if (!item) return null;
  const Model = mongoose.model(item.modelName);
  const doc = await Model.create(item.data);
  await item.deleteOne();
  return doc;
}

module.exports = { moveToBin, restoreFromBin };
