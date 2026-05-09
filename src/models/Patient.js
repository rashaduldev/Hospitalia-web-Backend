const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, unique: true, index: true },
    firstName: String,
    lastName: String,
    gender: String,
    email: String,
    countryCode: String,
    mobileNumber: String,
    dateOfBirth: String,
    bloodGroup: String,
    address: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Patient", patientSchema);
