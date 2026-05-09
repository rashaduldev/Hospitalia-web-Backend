const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    id: Number,
    senderUserId: Number,
    body: String,
    attachmentUrl: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatThreadSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    doctorUserId: { type: Number, index: true },
    patientUserId: { type: Number, index: true },
    subject: String,
    messages: [messageSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("ChatThread", chatThreadSchema);
