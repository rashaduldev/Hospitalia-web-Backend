const mongoose = require("mongoose");

const secretaryLocationSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    locationId: { type: Number, required: true, index: true },
    locationName: String,
    city: String,
    permissions: [String],
    doctorId: Number,
    doctorName: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("SecretaryLocation", secretaryLocationSchema);
