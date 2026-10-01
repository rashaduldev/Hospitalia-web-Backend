const mongoose = require("mongoose");

const specialitySchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

module.exports = require("../tenant/context").tenantModel("Speciality", specialitySchema);

