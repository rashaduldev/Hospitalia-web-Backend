const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = require("../tenant/context").tenantModel("Counter", counterSchema);

