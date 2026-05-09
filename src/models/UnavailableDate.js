const mongoose = require("mongoose");

const unavailableDateSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    doctorId: { type: Number, required: true, index: true },
    unavailableDate: { type: String, required: true },
    reason: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("UnavailableDate", unavailableDateSchema);
