const mongoose = require("mongoose");

const secretarySchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, unique: true, index: true },
    doctorUserId: { type: Number, index: true },
    doctorId: { type: Number, index: true },
    status: { type: String, enum: ["PENDING", "INVITED", "ACTIVE"], default: "PENDING" },
    firstName: String,
    lastName: String,
    gender: String,
    email: String,
    phoneNumber: String,
    invitationToken: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Secretary", secretarySchema);
