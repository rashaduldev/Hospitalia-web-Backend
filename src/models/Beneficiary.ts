const mongoose = require("mongoose");

const beneficiarySchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    patientUserId: { type: Number, required: true, index: true },
    firstName: String,
    lastName: String,
    gender: String,
    relation: String,
    age: Number,
    mobileNumber: String,
  },
  { timestamps: true },
);

module.exports = require("../tenant/context").tenantModel("Beneficiary", beneficiarySchema);

