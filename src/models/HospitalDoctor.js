const mongoose = require("mongoose");

const hospitalDoctorSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    hospitalId: { type: Number, required: true, index: true },
    hospitalUserId: { type: Number, index: true },
    doctorId: { type: Number, required: true, index: true },
    doctorUserId: { type: Number, index: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HospitalDoctor", hospitalDoctorSchema);
