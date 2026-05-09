const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    doctorId: { type: Number, index: true },
    doctorUserId: { type: Number, index: true },
    hospitalId: { type: Number, index: true },
    hospitalUserId: { type: Number, index: true },
    locationName: { type: String, required: true },
    address: String,
    city: String,
    country: String,
    latitude: Number,
    longitude: Number,
    fees: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Location", locationSchema);

