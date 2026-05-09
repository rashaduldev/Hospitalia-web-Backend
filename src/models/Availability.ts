const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    doctorId: { type: Number, required: true, index: true },
    doctorLocationId: { type: Number, required: true, index: true },
    dayOfWeek: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, default: 30 },
    fees: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Availability", availabilitySchema);

